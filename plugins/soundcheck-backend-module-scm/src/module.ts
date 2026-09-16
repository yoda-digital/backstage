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
import { ScmIntegrations } from '@backstage/integration';
import { soundcheckFactCollectorExtensionPoint } from '@backstage/plugin-soundcheck-node';
import { ScmFactCollector } from './collectors/ScmFactCollector';

/**
 * Registers the SCM source content analysis fact collector with the
 * soundcheck backend.
 * @public
 */
export default createBackendModule({
  pluginId: 'soundcheck',
  moduleId: 'scm-fact-collector',
  register(reg) {
    reg.registerInit({
      deps: {
        collectors: soundcheckFactCollectorExtensionPoint,
        config: coreServices.rootConfig,
        reader: coreServices.urlReader,
        logger: coreServices.logger,
      },
      async init({ collectors, config, reader, logger }) {
        const integrations = ScmIntegrations.fromConfig(config);
        const additionalFiles = config.getOptionalStringArray(
          'soundcheck.collectors.scm.additionalFiles',
        );
        const patternConfigs =
          config.getOptionalConfigArray('soundcheck.collectors.scm.patterns') ??
          [];
        const patterns = patternConfigs.map(pattern => ({
          name: pattern.getString('name'),
          path: pattern.getString('path'),
          regex: pattern.getString('regex'),
        }));

        collectors.addCollector(
          ScmFactCollector.create({
            integrations,
            reader,
            additionalFiles,
            patterns,
            logger,
          }),
        );
      },
    });
  },
});
