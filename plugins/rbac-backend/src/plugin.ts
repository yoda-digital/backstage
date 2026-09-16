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
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { eventsServiceRef } from '@backstage/plugin-events-node';
import { createPermissionIntegrationRouter } from '@backstage/plugin-permission-node';
import {
  rbacPolicyProviderExtensionPoint,
  type RbacPolicyProvider,
} from '@backstage/plugin-rbac-node';
import { RbacStore } from './database/RbacStore';
import { createRouter } from './service/router';
import {
  RBAC_CATALOG_ENTITY_RESOURCE_TYPE,
  rbacConditionalRules,
} from './service/conditionalRules';

/**
 * The RBAC backend plugin, providing role and binding management
 * via a REST API and database storage.
 *
 * @public
 */
export const rbacPlugin = createBackendPlugin({
  pluginId: 'rbac',
  register(env) {
    const providers: RbacPolicyProvider[] = [];

    env.registerExtensionPoint(rbacPolicyProviderExtensionPoint, {
      addProvider(provider) {
        providers.push(provider);
      },
    });

    env.registerInit({
      deps: {
        logger: coreServices.logger,
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        auth: coreServices.auth,
        catalog: catalogServiceRef,
        events: eventsServiceRef,
      },
      async init({
        logger,
        database,
        httpAuth,
        httpRouter,
        auth,
        catalog,
        events,
      }) {
        const store = await RbacStore.create({ database });

        for (const rule of rbacConditionalRules) {
          await store.addConditionalRule({
            id: `rbac:${rule.name}`,
            name: rule.name,
            description: rule.description,
            resourceType: RBAC_CATALOG_ENTITY_RESOURCE_TYPE,
            pluginId: 'rbac',
          });
        }

        const router = createRouter({ store, httpAuth, logger, events });
        httpRouter.use(router);
        httpRouter.use(
          createPermissionIntegrationRouter({
            resourceType: RBAC_CATALOG_ENTITY_RESOURCE_TYPE,
            rules: rbacConditionalRules,
            getResources: async resourceRefs => {
              const credentials = await auth.getOwnServiceCredentials();
              return Promise.all(
                resourceRefs.map(ref =>
                  catalog.getEntityByRef(ref, { credentials }),
                ),
              );
            },
          }),
        );
        httpRouter.addAuthPolicy({
          path: '/roles',
          allow: 'user-cookie',
        });
        httpRouter.addAuthPolicy({
          path: '/bindings',
          allow: 'user-cookie',
        });
        httpRouter.addAuthPolicy({
          path: '/policies',
          allow: 'user-cookie',
        });

        logger.info(
          `RBAC plugin initialized with ${providers.length} external policy provider(s)`,
        );
      },
    });
  },
});
