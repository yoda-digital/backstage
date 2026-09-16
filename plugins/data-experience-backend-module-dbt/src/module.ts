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
 * A Data Experience backend module that registers a {@link DbtConnector},
 * importing dbt models and sources as Dataset entities, and a
 * {@link DbtLineageProcessor} that links those datasets to their upstream
 * dependencies from the dbt manifest's `depends_on` graph.
 *
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
        catalog: catalogProcessingExtensionPoint,
      },
      async init({ config, logger, warehouse, catalog }) {
        if (!config.has('dataExperience.dbt')) {
          logger.info(
            'No dataExperience.dbt configuration found, skipping dbt connector registration',
          );
          return;
        }

        const connector = DbtConnector.fromConfig(config, { logger });
        warehouse.addConnector(connector);

        const manifest = await DbtManifest.fromConfig(config);
        catalog.addProcessor(new DbtLineageProcessor(manifest));

        logger.info('Registered dbt warehouse connector and lineage processor');
      },
    });
  },
});
