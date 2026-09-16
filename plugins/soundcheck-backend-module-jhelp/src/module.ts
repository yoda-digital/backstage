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
import { JHelpFactCollector } from './collectors/JHelpFactCollector';

/**
 * Registers the JHelp fact collector with the soundcheck backend.
 * @public
 */
export default createBackendModule({
  pluginId: 'soundcheck',
  moduleId: 'jhelp-fact-collector',
  register(reg) {
    reg.registerInit({
      deps: {
        collectors: soundcheckFactCollectorExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ collectors, config, logger }) {
        const baseUrl = config.getOptionalString(
          'soundcheck.collectors.jhelp.baseUrl',
        );
        const apiKey = config.getOptionalString(
          'soundcheck.collectors.jhelp.apiKey',
        );

        if (!baseUrl || !apiKey) {
          logger.info(
            'JHelp fact collector disabled: soundcheck.collectors.jhelp is not configured',
          );
          return;
        }

        collectors.addCollector(
          JHelpFactCollector.create({ baseUrl, apiKey, logger }),
        );
      },
    });
  },
});
