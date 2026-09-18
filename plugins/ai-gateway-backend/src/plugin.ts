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
  resolvePackagePath,
} from '@backstage/backend-plugin-api';
import { aiProviderExtensionPoint } from '@backstage/plugin-ai-gateway-node';
import { eventsServiceRef } from '@backstage/plugin-events-node';
import { createRouter } from './service/router';
import { ProviderManager } from './service/ProviderManager';
import { UsageTracker } from './service/UsageTracker';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-ai-gateway-backend',
  'migrations',
);

/**
 * The AI Gateway backend plugin. Proxies chat requests to registered AI
 * providers, routes them to the right model, and tracks token usage.
 *
 * @public
 */
export const aiGatewayPlugin = createBackendPlugin({
  pluginId: 'ai-gateway',
  register(env) {
    const providerManager = new ProviderManager();

    env.registerExtensionPoint(aiProviderExtensionPoint, providerManager);

    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        permissions: coreServices.permissions,
        events: eventsServiceRef,
      },
      async init({
        config,
        logger,
        database,
        httpRouter,
        httpAuth,
        permissions,
        events,
      }) {
        const knex = await database.getClient();
        await knex.migrate.latest({ directory: migrationsDir, tableName: 'knex_migrations_ai_gateway' });

        const usageTracker = new UsageTracker(knex);

        const router = createRouter({
          providerManager,
          usageTracker,
          httpAuth,
          permissions,
          logger,
          config,
          events,
        });

        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/providers',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/models',
          allow: 'unauthenticated',
        });

        logger.info('AI Gateway plugin initialized');
      },
    });
  },
});
