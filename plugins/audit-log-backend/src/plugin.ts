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

import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { eventsServiceRef } from '@backstage/plugin-events-node';
import { AuditEvent } from '@backstage/plugin-audit-log-common';
import { v4 as uuid } from 'uuid';
import { AuditStore } from './database/AuditStore';
import { createRouter } from './service/router';

/**
 * The audit-log backend plugin.
 * @public
 */
export const auditLogPlugin = createBackendPlugin({
  pluginId: 'audit-log',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        events: eventsServiceRef,
      },
      async init({ logger, database, httpAuth, httpRouter, events }) {
        const knex = await database.getClient();
        const store = await AuditStore.create({ database: knex });

        await events.subscribe({
          id: 'audit-log',
          topics: ['audit'],
          async onEvent(params) {
            const payload = params.eventPayload as Partial<AuditEvent>;
            await store.recordEvent({
              id: payload.id ?? uuid(),
              action: payload.action ?? 'unknown',
              actor: payload.actor ?? 'unknown',
              entityRef: payload.entityRef,
              metadata: payload.metadata,
              timestamp: payload.timestamp ?? new Date().toISOString(),
              status: payload.status ?? 'succeeded',
              severity: payload.severity ?? 'low',
              pluginId: payload.pluginId ?? 'unknown',
              requestDetails: payload.requestDetails,
            });
          },
        });

        const router = createRouter({ store, httpAuth });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/',
          allow: 'user-cookie',
        });

        logger.info('Audit log plugin initialized');
      },
    });
  },
});
