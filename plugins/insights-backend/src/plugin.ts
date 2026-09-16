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
import { InsightsStore } from './database/InsightsStore';
import { createRouter } from './service/router';

/**
 * The insights backend plugin.
 *
 * @public
 */
export const insightsPlugin = createBackendPlugin({
  pluginId: 'insights',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        scheduler: coreServices.scheduler,
        events: eventsServiceRef,
      },
      async init({
        config,
        logger,
        database,
        httpAuth,
        httpRouter,
        scheduler,
        events,
      }) {
        const knex = await database.getClient();
        const store = await InsightsStore.create({ database: knex });

        const freq =
          config.getOptionalNumber(
            'insights.aggregation.schedule.frequency.minutes',
          ) ?? 60;
        const timeout =
          config.getOptionalNumber(
            'insights.aggregation.schedule.timeout.minutes',
          ) ?? 10;

        await scheduler.scheduleTask({
          id: 'insights-aggregation',
          frequency: { minutes: freq },
          timeout: { minutes: timeout },
          fn: async () => {
            await store.aggregate('hour');
            await store.aggregate('day');
            logger.info('Aggregated insights events');
          },
        });

        const router = createRouter({
          store,
          httpAuth,
          logger,
          config,
          events,
        });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({ path: '/', allow: 'user-cookie' });

        logger.info('Insights plugin initialized');
      },
    });
  },
});
