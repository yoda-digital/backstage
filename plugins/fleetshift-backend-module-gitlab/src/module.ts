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
import { GitLabFleetshiftProvider } from './provider';

/**
 * Registers the GitLab merge request provider with the fleetshift backend.
 *
 * @public
 */
export const fleetshiftModuleGitlabProvider = createBackendModule({
  pluginId: 'fleetshift',
  moduleId: 'gitlab-provider',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        providers: fleetshiftProviderExtensionPoint,
      },
      async init({ config, logger, providers }) {
        const host =
          config.getOptionalString('fleetshift.providers.gitlab.host') ??
          config.getOptionalString('integrations.gitlab[0].host');
        const token =
          config.getOptionalString('fleetshift.providers.gitlab.token') ??
          config.getOptionalString('integrations.gitlab[0].token');

        if (!host || !token) {
          logger.info(
            'GitLab fleetshift provider disabled: no GitLab host/token configured',
          );
          return;
        }

        providers.addProvider(
          new GitLabFleetshiftProvider(host, token, logger),
        );
        logger.info('GitLab fleetshift provider registered');
      },
    });
  },
});
