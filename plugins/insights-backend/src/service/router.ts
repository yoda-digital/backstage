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
import { InputError, NotAllowedError } from '@backstage/errors';
import { Config } from '@backstage/config';
import type { EventsService } from '@backstage/plugin-events-node';
import { InsightsStore } from '../database/InsightsStore';

/** @internal */
export interface RouterOptions {
  store: InsightsStore;
  httpAuth: HttpAuthService;
  logger: LoggerService;
  config: Config;
  events: EventsService;
}

/**
 * Publishes an audit event to the `audit` topic for the insights plugin.
 */
async function publishAudit(
  events: EventsService,
  event: {
    action: string;
    actor: string;
    entityRef?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await events.publish({
    topic: 'audit',
    eventPayload: {
      action: event.action,
      actor: event.actor,
      entityRef: event.entityRef,
      metadata: event.metadata,
      status: 'succeeded',
      severity: 'low',
      pluginId: 'insights',
      timestamp: new Date().toISOString(),
    },
  });
}

/** @internal */
export function createRouter(options: RouterOptions) {
  const { store, httpAuth, logger, config, events } = options;
  const router = Router();
  router.use(express.json());

  router.post('/events', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const { eventType, target, metadata } = req.body as {
      eventType?: string;
      target?: string;
      metadata?: Record<string, unknown>;
    };
    if (!eventType) {
      throw new InputError('eventType is required');
    }
    const principal = credentials.principal as { userEntityRef?: string };
    if (!principal.userEntityRef) {
      throw new NotAllowedError(
        'Only authenticated users can perform this action',
      );
    }
    const userRef = principal.userEntityRef;
    await store.recordEvent({ eventType, userRef, target, metadata });
    await publishAudit(events, {
      action: 'insights.event.create',
      actor: userRef,
      entityRef: target,
      metadata: { eventType },
    });
    res.status(201).json({ recorded: true });
  });

  router.get('/events', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const { eventType, userRef, target, from, to, limit } = req.query as {
      eventType?: string;
      userRef?: string;
      target?: string;
      from?: string;
      to?: string;
      limit?: string;
    };
    const results = await store.queryEvents({
      eventType,
      userRef,
      target,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(results);
  });

  router.get('/aggregations', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const { key, period, from, to } = req.query as {
      key?: string;
      period?: string;
      from?: string;
      to?: string;
    };
    if (!key || !period || !from || !to) {
      throw new InputError('key, period, from, and to are required');
    }
    const aggregations = await store.getAggregations(key, period, from, to);
    res.json(aggregations);
  });

  router.get('/top-features', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const { from, to, limit } = req.query as {
      from?: string;
      to?: string;
      limit?: string;
    };
    const now = new Date();
    const defaultFrom = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const topFeatures = await store.getTopFeatures({
      from: from ?? defaultFrom,
      to: to ?? now.toISOString(),
      limit: limit ? Number(limit) : undefined,
    });
    res.json(topFeatures);
  });

  router.get('/search-analytics', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const { from, to } = req.query as { from?: string; to?: string };
    const now = new Date();
    const defaultFrom = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const analytics = await store.getSearchAnalytics({
      from: from ?? defaultFrom,
      to: to ?? now.toISOString(),
    });
    res.json(analytics);
  });

  const middleware = MiddlewareFactory.create({ config, logger });
  router.use(middleware.error());
  return router;
}
