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
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { dataExperienceWarehouseExtensionPoint } from '@backstage/plugin-data-experience-node';
import { DbtConnector } from './connector/DbtConnector';
import { DbtManifest } from './manifest/DbtManifest';
import { DbtLineageProcessor } from './processor/DbtLineageProcessor';

/**
 * Data Experience module that registers the dbt warehouse connector.
 * @public
 */
export const dataExperienceModuleDbt = createBackendModule({
  pluginId: 'data-experience',
  moduleId: 'dbt',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        warehouse: dataExperienceWarehouseExtensionPoint,
      },
      async init({ config, logger, warehouse }) {
        if (!config.has('dataExperience.dbt')) {
          logger.info(
            'No dataExperience.dbt configuration found, skipping dbt connector',
          );
          return;
        }
        const connector = DbtConnector.fromConfig(config, { logger });
        warehouse.addConnector(connector);
        logger.info('Registered dbt warehouse connector');
      },
    });
  },
});

/**
 * Catalog module that registers the dbt lineage processor.
 * Must be loaded separately because catalogProcessingExtensionPoint
 * is scoped to pluginId 'catalog'.
 * @public
 */
export const catalogModuleDbtLineage = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'dbt-lineage',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        catalog: catalogProcessingExtensionPoint,
      },
      async init({ config, logger, catalog }) {
        if (!config.has('dataExperience.dbt')) {
          logger.info(
            'No dataExperience.dbt configuration found, skipping dbt lineage processor',
          );
          return;
        }
        const manifest = await DbtManifest.fromConfig(config);
        catalog.addProcessor(new DbtLineageProcessor(manifest));
        logger.info('Registered dbt lineage processor');
      },
    });
  },
});
