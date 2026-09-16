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
} from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { soundcheckFactCollectorExtensionPoint } from '@backstage/plugin-soundcheck-node';
import { DatadogFactCollector } from './collectors/DatadogFactCollector';

/**
 * Registers the Datadog fact collector with the soundcheck backend.
 * @public
 */
export default createBackendModule({
  pluginId: 'soundcheck',
  moduleId: 'datadog-fact-collector',
  register(reg) {
    reg.registerInit({
      deps: {
        collectors: soundcheckFactCollectorExtensionPoint,
        config: coreServices.rootConfig,
        catalog: catalogServiceRef,
        auth: coreServices.auth,
        logger: coreServices.logger,
      },
      async init({ collectors, config, catalog, auth, logger }) {
        const baseUrl = config.getOptionalString(
          'soundcheck.collectors.datadog.baseUrl',
        );
        const appKey = config.getOptionalString(
          'soundcheck.collectors.datadog.appKey',
        );
        const apiKey = config.getOptionalString(
          'soundcheck.collectors.datadog.apiKey',
        );

        if (!baseUrl || !appKey || !apiKey) {
          logger.info(
            'Datadog fact collector disabled: soundcheck.collectors.datadog is not configured',
          );
          return;
        }

        collectors.addCollector(
          DatadogFactCollector.create({
            baseUrl,
            appKey,
            apiKey,
            catalog,
            auth,
            logger,
          }),
        );
      },
    });
  },
});
