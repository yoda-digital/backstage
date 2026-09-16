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
import { notificationService } from '@backstage/plugin-notifications-node';
import { eventsServiceRef } from '@backstage/plugin-events-node';
import { GigStore } from './database/GigStore';
import { MatchingEngine } from './service/MatchingEngine';
import { createRouter } from './service/router';

/**
 * The skill-exchange backend plugin: gig CRUD, a skill matching engine,
 * and notification integration.
 *
 * @public
 */
export const skillExchangePlugin = createBackendPlugin({
  pluginId: 'skill-exchange',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        notifications: notificationService,
        events: eventsServiceRef,
      },
      async init({
        config,
        logger,
        database,
        httpAuth,
        httpRouter,
        notifications,
        events,
      }) {
        const knex = await database.getClient();
        const store = await GigStore.create({ database: knex });
        const matcher = new MatchingEngine();
        const configuredSkills =
          config.getOptionalStringArray('skillExchange.skills') ?? [];

        const router = createRouter({
          store,
          matcher,
          httpAuth,
          logger,
          config,
          notifications,
          configuredSkills,
          events,
        });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/',
          allow: 'user-cookie',
        });

        logger.info('Skill Exchange backend plugin initialized');
      },
    });
  },
});
