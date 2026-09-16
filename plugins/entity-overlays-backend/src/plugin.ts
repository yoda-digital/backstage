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
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { eventsServiceRef } from '@backstage/plugin-events-node';
import { OverlayStore } from './database/OverlayStore';
import { OverlayProcessor } from './processor/OverlayProcessor';
import { createRouter } from './service/router';

/**
 * The entity-overlays backend plugin.
 *
 * @public
 */
export const entityOverlaysPlugin = createBackendPlugin({
  pluginId: 'entity-overlays',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        events: eventsServiceRef,
      },
      async init({ config, logger, database, httpAuth, httpRouter, events }) {
        const knex = await database.getClient();
        const store = await OverlayStore.create({ database: knex });

        const router = createRouter({
          store,
          httpAuth,
          logger,
          config,
          events,
        });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/',
          allow: 'user-cookie',
        });

        logger.info('Entity overlays plugin initialized');
      },
    });
  },
});

/**
 * A catalog module that registers the overlay processor.
 *
 * @public
 */
export const catalogModuleEntityOverlays = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'entity-overlays-processor',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        database: coreServices.database,
      },
      async init({ catalog, database }) {
        const knex = await database.getClient();
        const store = await OverlayStore.create({ database: knex });
        catalog.addProcessor(new OverlayProcessor(store));
      },
    });
  },
});
