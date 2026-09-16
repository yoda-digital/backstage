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
import { eventsServiceRef } from '@backstage/plugin-events-node';
import { JobStore } from './database/JobStore';
import {
  CatalogBuilderEntityProvider,
  IngestionEngine,
} from './service/IngestionEngine';
import { createRouter } from './service/router';

/**
 * Shared entity provider instance used to inject Portal-managed entities
 * into the catalog. It is registered with the catalog via
 * {@link catalogModuleCatalogBuilder}, and driven by the
 * {@link IngestionEngine} created in the `catalog-builder` plugin below.
 *
 * @internal
 */
export const catalogBuilderEntityProvider = new CatalogBuilderEntityProvider();

/**
 * The catalog-builder backend plugin.
 *
 * @public
 */
export const catalogBuilderPlugin = createBackendPlugin({
  pluginId: 'catalog-builder',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        auth: coreServices.auth,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        scheduler: coreServices.scheduler,
        catalog: catalogServiceRef,
        events: eventsServiceRef,
      },
      async init({
        config,
        logger,
        database,
        auth,
        httpAuth,
        httpRouter,
        scheduler,
        catalog,
        events,
      }) {
        const knex = await database.getClient();
        const store = await JobStore.create({ database: knex });

        const engine = new IngestionEngine({
          config,
          logger,
          store,
          catalog,
          auth,
          scheduler,
          entityProvider: catalogBuilderEntityProvider,
        });

        const router = createRouter({
          store,
          engine,
          httpAuth,
          logger,
          config,
          events,
        });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({ path: '/', allow: 'user-cookie' });

        logger.info('Catalog builder plugin initialized');
      },
    });
  },
});

/**
 * A catalog module that registers the {@link CatalogBuilderEntityProvider},
 * allowing Portal-managed entities created by the catalog-builder to be
 * injected directly into the catalog without a `catalog-info.yaml` file.
 *
 * @public
 */
export const catalogModuleCatalogBuilder = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'catalog-builder-entity-provider',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
      },
      async init({ catalog }) {
        catalog.addEntityProvider(catalogBuilderEntityProvider);
      },
    });
  },
});
