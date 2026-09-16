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
import { soundcheckFactCollectorExtensionPoint } from '@backstage/plugin-soundcheck-node';
import { HttpFactCollector } from './collectors/HttpFactCollector';

/**
 * Registers a generic HTTP fact collector for each configured endpoint
 * under `soundcheck.collectors.http.endpoints`.
 * @public
 */
export default createBackendModule({
  pluginId: 'soundcheck',
  moduleId: 'http-fact-collector',
  register(reg) {
    reg.registerInit({
      deps: {
        collectors: soundcheckFactCollectorExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ collectors, config, logger }) {
        const endpoints =
          config.getOptionalConfigArray(
            'soundcheck.collectors.http.endpoints',
          ) ?? [];

        for (const endpoint of endpoints) {
          collectors.addCollector(
            HttpFactCollector.create({
              endpoint: {
                factRef: endpoint.getString('factRef'),
                url: endpoint.getString('url'),
                method: endpoint.getOptionalString('method'),
                headers: endpoint.getOptional('headers') as
                  | Record<string, string>
                  | undefined,
                jsonPath: endpoint.getOptionalString('jsonPath'),
              },
              logger,
            }),
          );
        }
      },
    });
  },
});
