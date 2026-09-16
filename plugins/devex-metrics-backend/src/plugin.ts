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
import { DoraMetricName } from '@backstage/plugin-devex-metrics-common';
import { eventsServiceRef } from '@backstage/plugin-events-node';
import { MetricsStore } from './database/MetricsStore';
import { createRouter } from './service/router';
import {
  devexMetricsCollectorExtensionPoint,
  MetricCollector,
} from './extensions';

const DORA_METRICS: DoraMetricName[] = [
  'deployment_frequency',
  'lead_time_for_changes',
  'mean_time_to_restore',
  'change_failure_rate',
];

/**
 * The devex-metrics backend plugin.
 *
 * @public
 */
export const devexMetricsPlugin = createBackendPlugin({
  pluginId: 'devex-metrics',
  register(env) {
    const collectors: MetricCollector[] = [];

    env.registerExtensionPoint(devexMetricsCollectorExtensionPoint, {
      addCollector(collector) {
        collectors.push(collector);
      },
    });

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
        const store = await MetricsStore.create({ database: knex });

        const freq =
          config.getOptionalNumber(
            'devexMetrics.collection.schedule.frequency.minutes',
          ) ?? 60;
        const timeout =
          config.getOptionalNumber(
            'devexMetrics.collection.schedule.timeout.minutes',
          ) ?? 10;

        await scheduler.scheduleTask({
          id: 'devex-metrics-collection',
          frequency: { minutes: freq },
          timeout: { minutes: timeout },
          fn: async () => {
            const to = new Date().toISOString();
            const from = new Date(Date.now() - freq * 60 * 1000).toISOString();
            for (const collector of collectors) {
              for (const metric of DORA_METRICS) {
                try {
                  const points = await collector.collect({
                    metric,
                    from,
                    to,
                  });
                  for (const point of points) {
                    await store.recordMetric(
                      metric,
                      point,
                      collector.collectorId,
                    );
                  }
                } catch (error) {
                  logger.error(
                    `Failed to collect ${metric} from ${collector.collectorId}: ${error}`,
                  );
                }
              }
              logger.info(`Collected metrics from ${collector.collectorId}`);
            }
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

        logger.info('DevEx metrics plugin initialized');
      },
    });
  },
});
