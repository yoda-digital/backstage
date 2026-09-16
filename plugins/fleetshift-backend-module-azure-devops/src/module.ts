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
import { fleetshiftProviderExtensionPoint } from '@backstage/plugin-fleetshift-node';
import { AzureDevOpsFleetshiftProvider } from './provider';

/**
 * Registers the Azure DevOps pull request provider with the fleetshift
 * backend.
 *
 * @public
 */
export const fleetshiftModuleAzureDevOpsProvider = createBackendModule({
  pluginId: 'fleetshift',
  moduleId: 'azure-devops-provider',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        providers: fleetshiftProviderExtensionPoint,
      },
      async init({ config, logger, providers }) {
        const token = config.getOptionalString(
          'fleetshift.providers.azureDevOps.token',
        );

        if (!token) {
          logger.info(
            'Azure DevOps fleetshift provider disabled: fleetshift.providers.azureDevOps is not configured',
          );
          return;
        }

        providers.addProvider(new AzureDevOpsFleetshiftProvider(token, logger));
        logger.info('Azure DevOps fleetshift provider registered');
      },
    });
  },
});
