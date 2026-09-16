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

import Router from 'express-promise-router';
import express, { Request, Response } from 'express';
import { Config } from '@backstage/config';
import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';
import { NotAllowedError, ResponseError } from '@backstage/errors';
import type { EventsService } from '@backstage/plugin-events-node';

/** @internal */
export interface RouterOptions {
  config: Config;
  httpAuth: HttpAuthService;
  logger: LoggerService;
  events: EventsService;
}

const PROXIED_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Publishes an audit event to the `audit` topic for the growthbook plugin.
 */
async function publishAudit(
  events: EventsService,
  event: {
    action: string;
    actor: string;
    entityRef?: string;
  },
): Promise<void> {
  await events.publish({
    topic: 'audit',
    eventPayload: {
      action: event.action,
      actor: event.actor,
      entityRef: event.entityRef,
      status: 'succeeded',
      severity: 'medium',
      pluginId: 'growthbook',
      timestamp: new Date().toISOString(),
    },
  });
}

/** @internal */
export function createRouter(options: RouterOptions) {
  const { config, httpAuth, logger, events } = options;
  const router = Router();
  router.use(express.json());

  const apiUrl = config.getString('growthbook.apiUrl');
  const apiKey = config.getString('growthbook.apiKey');

  async function proxy(
    path: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });

    const isMutation = PROXIED_METHODS.has(req.method);
    let actor: string | undefined;
    if (isMutation) {
      const principal = credentials.principal as { userEntityRef?: string };
      if (!principal.userEntityRef) {
        throw new NotAllowedError(
          'Only authenticated users can perform this action',
        );
      }
      actor = principal.userEntityRef;
    }

    const url = `${apiUrl}/api/v1${path}`;
    const response = await fetch(url, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: isMutation ? JSON.stringify(req.body) : undefined,
    });

    if (!response.ok && response.status >= 500) {
      throw await ResponseError.fromResponse(response);
    }

    const data = await response.json();

    if (isMutation && actor && response.ok) {
      const resource = path.replace(/^\//, '').split('/')[0] ?? 'resource';
      const verb = req.method === 'POST' ? 'create' : 'update';
      await publishAudit(events, {
        action: `growthbook.${resource}.${verb}`,
        actor,
        entityRef: path,
      });
    }

    res.status(response.status).json(data);
  }

  router.get('/features', (req, res) => proxy('/features', req, res));
  router.get('/features/:id', (req, res) =>
    proxy(`/features/${req.params.id}`, req, res),
  );
  router.post('/features', (req, res) => proxy('/features', req, res));
  router.put('/features/:id', (req, res) =>
    proxy(`/features/${req.params.id}`, req, res),
  );

  router.get('/experiments', (req, res) => proxy('/experiments', req, res));
  router.get('/experiments/:id', (req, res) =>
    proxy(`/experiments/${req.params.id}`, req, res),
  );
  router.post('/experiments', (req, res) => proxy('/experiments', req, res));

  logger.info(`GrowthBook proxy configured against ${apiUrl}`);

  const middleware = MiddlewareFactory.create({ config, logger });
  router.use(middleware.error());
  return router;
}
