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
import { SnykFactCollector } from './collectors/SnykFactCollector';

/**
 * Registers the Snyk fact collector with the soundcheck backend.
 * @public
 */
export default createBackendModule({
  pluginId: 'soundcheck',
  moduleId: 'snyk-fact-collector',
  register(reg) {
    reg.registerInit({
      deps: {
        collectors: soundcheckFactCollectorExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ collectors, config, logger }) {
        const baseUrl = config.getOptionalString(
          'soundcheck.collectors.snyk.baseUrl',
        );
        const token = config.getOptionalString(
          'soundcheck.collectors.snyk.token',
        );
        const orgId = config.getOptionalString(
          'soundcheck.collectors.snyk.orgId',
        );

        if (!baseUrl || !token || !orgId) {
          logger.info(
            'Snyk fact collector disabled: soundcheck.collectors.snyk is not configured',
          );
          return;
        }

        collectors.addCollector(
          SnykFactCollector.create({ baseUrl, token, orgId, logger }),
        );
      },
    });
  },
});
