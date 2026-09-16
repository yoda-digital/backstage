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
import { SnowflakeConnector } from './connector/SnowflakeConnector';

/**
 * A Data Experience backend module that registers a
 * {@link SnowflakeConnector}, importing tables and views from a configured
 * Snowflake account as Dataset entities.
 *
 * @public
 */
export const dataExperienceModuleSnowflake = createBackendModule({
  pluginId: 'data-experience',
  moduleId: 'snowflake',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        warehouse: dataExperienceWarehouseExtensionPoint,
      },
      async init({ config, logger, warehouse }) {
        if (!config.has('dataExperience.snowflake')) {
          logger.info(
            'No dataExperience.snowflake configuration found, skipping Snowflake connector registration',
          );
          return;
        }

        const connector = SnowflakeConnector.fromConfig(config, { logger });
        warehouse.addConnector(connector);
        logger.info('Registered Snowflake warehouse connector');
      },
    });
  },
});
