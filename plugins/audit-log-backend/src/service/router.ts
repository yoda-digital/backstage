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

import { HttpAuthService } from '@backstage/backend-plugin-api';
import { InputError, NotAllowedError } from '@backstage/errors';
import { AuditQuery } from '@backstage/plugin-audit-log-common';
import express from 'express';
import Router from 'express-promise-router';
import { v4 as uuid } from 'uuid';
import { AuditStore } from '../database/AuditStore';

/** @internal */
export interface RouterOptions {
  store: AuditStore;
  httpAuth: HttpAuthService;
}

/** @internal */
export function createRouter(options: RouterOptions): express.Router {
  const { store, httpAuth } = options;
  const router = Router();
  router.use(express.json());

  router.get('/events', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const query: AuditQuery = {
      actor: asOptionalString(req.query.actor),
      entityRef: asOptionalString(req.query.entityRef),
      action: asOptionalString(req.query.action),
      severity: asOptionalString(req.query.severity) as
        | AuditQuery['severity']
        | undefined,
      pluginId: asOptionalString(req.query.pluginId),
      from: asOptionalString(req.query.from),
      to: asOptionalString(req.query.to),
      limit: asOptionalNumber(req.query.limit),
      offset: asOptionalNumber(req.query.offset),
    };

    const result = await store.queryEvents(query);
    res.json(result);
  });

  router.post('/events', async (req, res) => {
    const credentials = await httpAuth.credentials(req, {
      allow: ['user', 'service'],
    });
    // Write endpoints should verify caller identity: a 'user' principal
    // must resolve to a real user entity ref, while 'service' principals
    // (other backend plugins publishing audit events on a user's behalf)
    // are trusted based on their service identity.
    if (
      credentials.principal.type === 'user' &&
      !credentials.principal.userEntityRef
    ) {
      throw new NotAllowedError(
        'Only authenticated users can perform this action',
      );
    }

    const {
      action,
      actor,
      entityRef,
      metadata,
      status,
      severity,
      pluginId,
      requestDetails,
    } = req.body;
    if (!action || !actor) {
      throw new InputError('action and actor are required');
    }

    await store.recordEvent({
      id: uuid(),
      action,
      actor,
      entityRef,
      metadata,
      timestamp: new Date().toISOString(),
      status: status ?? 'succeeded',
      severity: severity ?? 'low',
      pluginId: pluginId ?? 'unknown',
      requestDetails,
    });

    res.status(201).json({ recorded: true });
  });

  return router;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'string' && value.length > 0) {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      return num;
    }
  }
  return undefined;
}
