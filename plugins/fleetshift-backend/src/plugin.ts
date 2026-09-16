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
import {
  FleetshiftProvider,
  fleetshiftProviderExtensionPoint,
} from '@backstage/plugin-fleetshift-node';
import { eventsServiceRef } from '@backstage/plugin-events-node';
import { ShiftStore } from './database/ShiftStore';
import { ShiftEngine } from './service/ShiftEngine';
import { createRouter } from './service/router';

/**
 * The fleetshift backend plugin.
 *
 * @public
 */
export const fleetshiftPlugin = createBackendPlugin({
  pluginId: 'fleetshift',
  register(env) {
    const providers = new Map<string, FleetshiftProvider>();

    env.registerExtensionPoint(fleetshiftProviderExtensionPoint, {
      addProvider(provider) {
        providers.set(provider.providerId, provider);
      },
    });

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
        const store = await ShiftStore.create({ database: knex });

        const aiGatewayBaseUrl = config.getOptionalString(
          'fleetshift.aiGateway.baseUrl',
        );
        const aiGatewayModel =
          config.getOptionalString('fleetshift.aiGateway.model') ??
          'claude-sonnet-4-20250514';

        const engine = new ShiftEngine(
          store,
          providers,
          aiGatewayBaseUrl,
          aiGatewayModel,
          fetch,
          logger,
        );

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

        logger.info('Fleetshift plugin initialized');
      },
    });
  },
});
