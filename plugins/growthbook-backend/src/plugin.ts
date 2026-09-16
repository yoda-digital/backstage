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
import { createRouter } from './service/router';

/**
 * The growthbook backend plugin: a REST API proxy for GrowthBook OSS,
 * authenticated with Backstage credentials.
 *
 * @public
 */
export const growthbookPlugin = createBackendPlugin({
  pluginId: 'growthbook',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        events: eventsServiceRef,
      },
      async init({ config, logger, httpAuth, httpRouter, events }) {
        const router = createRouter({ config, httpAuth, logger, events });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/',
          allow: 'user-cookie',
        });
        logger.info('GrowthBook proxy plugin initialized');
      },
    });
  },
});
