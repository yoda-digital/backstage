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
import { BigQueryFactCollector } from './collectors/BigQueryFactCollector';

/**
 * Registers the BigQuery fact collector with the soundcheck backend.
 * @public
 */
export default createBackendModule({
  pluginId: 'soundcheck',
  moduleId: 'bigquery-fact-collector',
  register(reg) {
    reg.registerInit({
      deps: {
        collectors: soundcheckFactCollectorExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ collectors, config, logger }) {
        const projectId = config.getOptionalString(
          'soundcheck.collectors.bigquery.projectId',
        );
        const credentials = config.getOptionalString(
          'soundcheck.collectors.bigquery.credentials',
        );

        if (!projectId || !credentials) {
          logger.info(
            'BigQuery fact collector disabled: soundcheck.collectors.bigquery is not configured',
          );
          return;
        }

        collectors.addCollector(
          BigQueryFactCollector.create({ projectId, credentials, logger }),
        );
      },
    });
  },
});
