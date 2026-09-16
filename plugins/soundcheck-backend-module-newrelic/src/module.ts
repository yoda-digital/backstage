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
import { NewRelicFactCollector } from './collectors/NewRelicFactCollector';

/**
 * Registers the New Relic fact collector with the soundcheck backend.
 * @public
 */
export default createBackendModule({
  pluginId: 'soundcheck',
  moduleId: 'newrelic-fact-collector',
  register(reg) {
    reg.registerInit({
      deps: {
        collectors: soundcheckFactCollectorExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ collectors, config, logger }) {
        const baseUrl = config.getOptionalString(
          'soundcheck.collectors.newrelic.baseUrl',
        );
        const apiKey = config.getOptionalString(
          'soundcheck.collectors.newrelic.apiKey',
        );

        if (!baseUrl || !apiKey) {
          logger.info(
            'New Relic fact collector disabled: soundcheck.collectors.newrelic is not configured',
          );
          return;
        }

        collectors.addCollector(
          NewRelicFactCollector.create({ baseUrl, apiKey, logger }),
        );
      },
    });
  },
});
