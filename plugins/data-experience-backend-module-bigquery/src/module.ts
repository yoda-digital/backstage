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
import { dataExperienceWarehouseExtensionPoint } from '@backstage/plugin-data-experience-node';
import { BigQueryConnector } from './connector/BigQueryConnector';

/**
 * A Data Experience backend module that registers a
 * {@link BigQueryConnector}, importing tables, views, and materialized
 * views from a configured Google BigQuery project as Dataset entities.
 *
 * @public
 */
export const dataExperienceModuleBigquery = createBackendModule({
  pluginId: 'data-experience',
  moduleId: 'bigquery',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        warehouse: dataExperienceWarehouseExtensionPoint,
      },
      async init({ config, logger, warehouse }) {
        if (!config.has('dataExperience.bigquery')) {
          logger.info(
            'No dataExperience.bigquery configuration found, skipping BigQuery connector registration',
          );
          return;
        }

        const connector = BigQueryConnector.fromConfig(config, { logger });
        warehouse.addConnector(connector);
        logger.info('Registered BigQuery warehouse connector');
      },
    });
  },
});
