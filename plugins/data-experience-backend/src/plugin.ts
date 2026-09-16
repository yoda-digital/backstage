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
  createBackendModule,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import {
  catalogProcessingExtensionPoint,
  catalogServiceRef,
} from '@backstage/plugin-catalog-node';
import {
  dataExperienceWarehouseExtensionPoint,
  WarehouseConnector,
} from '@backstage/plugin-data-experience-node';
import { notificationService } from '@backstage/plugin-notifications-node';
import { eventsServiceRef } from '@backstage/plugin-events-node';
import { DatasetStore } from './database/DatasetStore';
import { DatasetProcessor } from './processor/DatasetProcessor';
import { AccessRequestStore } from './service/AccessRequestStore';
import { createRouter, refreshDatasetMetadata } from './service/router';

/**
 * The data-experience backend plugin.
 *
 * @public
 */
export const dataExperienceBackendPlugin = createBackendPlugin({
  pluginId: 'data-experience',
  register(env) {
    const connectors: WarehouseConnector[] = [];

    env.registerExtensionPoint(dataExperienceWarehouseExtensionPoint, {
      addConnector(connector) {
        connectors.push(connector);
      },
    });

    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        auth: coreServices.auth,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        catalog: catalogServiceRef,
        scheduler: coreServices.scheduler,
        notifications: notificationService,
        events: eventsServiceRef,
      },
      async init({
        config,
        logger,
        database,
        auth,
        httpAuth,
        httpRouter,
        catalog,
        scheduler,
        notifications,
        events,
      }) {
        const knex = await database.getClient();
        const store = await DatasetStore.create({ database: knex });
        const accessRequestStore = await AccessRequestStore.create({
          database: knex,
        });

        const router = createRouter({
          store,
          accessRequestStore,
          connectors,
          catalog,
          auth,
          httpAuth,
          logger,
          config,
          notifications,
          events,
        });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/',
          allow: 'user-cookie',
        });

        const frequencyMinutes =
          config.getOptionalNumber(
            'dataExperience.collection.schedule.frequency.minutes',
          ) ?? 60;
        const timeoutMinutes =
          config.getOptionalNumber(
            'dataExperience.collection.schedule.timeout.minutes',
          ) ?? 10;

        await scheduler.scheduleTask({
          id: 'data-experience-metadata-collection',
          frequency: { minutes: frequencyMinutes },
          timeout: { minutes: timeoutMinutes },
          fn: async () => {
            const credentials = await auth.getOwnServiceCredentials();
            const { items } = await catalog.getEntities(
              { filter: { kind: 'Dataset' } },
              { credentials },
            );
            for (const entity of items) {
              try {
                await refreshDatasetMetadata(entity, connectors, store);
              } catch (error) {
                logger.warn(
                  `Failed to collect metadata for ${entity.metadata.name}: ${error}`,
                );
              }
            }
          },
        });

        logger.info('Data Experience backend plugin initialized');
      },
    });
  },
});

/**
 * A catalog module that registers the {@link DatasetProcessor}, which
 * validates `Dataset` kind entities.
 *
 * @public
 */
export const catalogModuleDataExperience = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'data-experience-dataset-processor',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
      },
      async init({ catalog }) {
        catalog.addProcessor(new DatasetProcessor());
      },
    });
  },
});
