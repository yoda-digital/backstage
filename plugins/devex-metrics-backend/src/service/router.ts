/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import express from 'express';
import Router from 'express-promise-router';
import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';
import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import { Config } from '@backstage/config';
import type { EventsService } from '@backstage/plugin-events-node';
import {
  DoraMetricName,
  MetricTimeRange,
  SurveyDefinition,
  SurveyQuestion,
} from '@backstage/plugin-devex-metrics-common';
import { MetricsStore } from '../database/MetricsStore';

const VALID_METRICS: DoraMetricName[] = [
  'deployment_frequency',
  'lead_time_for_changes',
  'mean_time_to_restore',
  'change_failure_rate',
];

/** @internal */
export interface RouterOptions {
  store: MetricsStore;
  httpAuth: HttpAuthService;
  logger: LoggerService;
  config: Config;
  events: EventsService;
}

/**
 * Publishes an audit event to the `audit` topic for the devex-metrics
 * plugin.
 */
async function publishAudit(
  events: EventsService,
  event: {
    action: string;
    actor: string;
    entityRef?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  },
): Promise<void> {
  await events.publish({
    topic: 'audit',
    eventPayload: {
      action: event.action,
      actor: event.actor,
      entityRef: event.entityRef,
      status: 'succeeded',
      severity: event.severity ?? 'medium',
      pluginId: 'devex-metrics',
      timestamp: new Date().toISOString(),
    },
  });
}

/** Verifies the caller is an authenticated user, returning their entity ref. */
function requireUserRef(credentials: { principal: unknown }): string {
  const principal = credentials.principal as { userEntityRef?: string };
  if (!principal.userEntityRef) {
    throw new NotAllowedError(
      'Only authenticated users can perform this action',
    );
  }
  return principal.userEntityRef;
}

/** @internal */
export function createRouter(options: RouterOptions) {
  const { store, httpAuth, logger, config, events } = options;
  const router = Router();
  router.use(express.json());

  router.get('/dora', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const { metric, from, to, entityRef, team, granularity } = req.query as {
      metric?: string;
      from?: string;
      to?: string;
      entityRef?: string;
      team?: string;
      granularity?: string;
    };
    if (!metric || !VALID_METRICS.includes(metric as DoraMetricName)) {
      throw new InputError(`metric must be one of ${VALID_METRICS.join(', ')}`);
    }
    if (!from || !to) {
      throw new InputError('from and to query parameters are required');
    }
    const timeRange: MetricTimeRange = {
      from,
      to,
      granularity: (granularity as MetricTimeRange['granularity']) ?? 'day',
    };
    const points = await store.queryMetrics({
      metric: metric as DoraMetricName,
      timeRange,
      segment: { entityRef, team },
    });
    res.json({ metric, points });
  });

  router.get('/ai-usage', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const baseUrl = config.getOptionalString('devexMetrics.aiGateway.baseUrl');
    if (!baseUrl) {
      res.json({
        totalRequests: 0,
        totalTokens: 0,
        byProvider: {},
        byUser: {},
        dataPoints: [],
      });
      return;
    }
    const { from, to } = req.query as { from?: string; to?: string };
    const url = new URL('/usage', baseUrl);
    if (from) url.searchParams.set('from', from);
    if (to) url.searchParams.set('to', to);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        logger.warn(`AI Gateway usage request failed: ${response.status}`);
        res.status(response.status).json({ error: 'AI Gateway unavailable' });
        return;
      }
      const usage = await response.json();
      res.json(usage);
    } catch (error) {
      logger.warn(`Failed to reach AI Gateway: ${error}`);
      res.status(502).json({ error: 'AI Gateway unreachable' });
    }
  });

  router.get('/surveys', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const surveys = await store.listSurveys();
    res.json(surveys);
  });

  router.post('/surveys', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const actor = requireUserRef(credentials);
    const { id, title, description, questions, active } =
      req.body as Partial<SurveyDefinition>;
    if (!id || !title || !Array.isArray(questions)) {
      throw new InputError('id, title, and questions are required');
    }
    const survey: SurveyDefinition = {
      id,
      title,
      description: description ?? '',
      questions: questions as SurveyQuestion[],
      active: active ?? true,
      createdAt: new Date().toISOString(),
    };
    await store.createSurvey(survey);
    await publishAudit(events, {
      action: 'devex-metrics.survey.create',
      actor,
      entityRef: survey.id,
    });
    res.status(201).json(survey);
  });

  router.post('/surveys/:id/responses', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const respondent = requireUserRef(credentials);
    const surveyId = req.params.id;
    const survey = await store.getSurvey(surveyId);
    if (!survey) {
      throw new NotFoundError(`No survey found with id ${surveyId}`);
    }
    const { answers } = req.body as { answers?: Record<string, unknown> };
    if (!answers || typeof answers !== 'object') {
      throw new InputError('answers must be provided');
    }
    await store.submitResponse({
      surveyId,
      respondent,
      answers: answers as Record<string, string | number>,
      submittedAt: new Date().toISOString(),
    });
    await publishAudit(events, {
      action: 'devex-metrics.survey.response.create',
      actor: respondent,
      entityRef: surveyId,
      severity: 'low',
    });
    res.status(201).json({ surveyId, respondent });
  });

  router.get('/surveys/:id/results', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const surveyId = req.params.id;
    const survey = await store.getSurvey(surveyId);
    if (!survey) {
      throw new NotFoundError(`No survey found with id ${surveyId}`);
    }
    const responses = await store.getSurveyResults(surveyId);
    res.json({ survey, responses, responseCount: responses.length });
  });

  const middleware = MiddlewareFactory.create({ config, logger });
  router.use(middleware.error());
  return router;
}
