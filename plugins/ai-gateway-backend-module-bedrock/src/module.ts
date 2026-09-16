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
import { aiProviderExtensionPoint } from '@backstage/plugin-ai-gateway-node';
import { BedrockProvider } from './providers/BedrockProvider';

/** Registers the AWS Bedrock AI provider with the AI Gateway. */
export const aiGatewayModuleBedrock = createBackendModule({
  pluginId: 'ai-gateway',
  moduleId: 'bedrock',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        providers: aiProviderExtensionPoint,
      },
      async init({ config, logger, providers }) {
        const providerConfig = config.getOptionalConfig(
          'aiGateway.providers.bedrock',
        );
        if (!providerConfig) {
          logger.warn(
            'AWS Bedrock AI provider is not configured, skipping registration',
          );
          return;
        }

        const region = providerConfig.getString('region');
        const accessKeyId = providerConfig.getOptionalString('accessKeyId');
        const secretAccessKey =
          providerConfig.getOptionalString('secretAccessKey');

        providers.registerProvider(
          BedrockProvider.create(
            { region, accessKeyId, secretAccessKey },
            logger,
          ),
        );
      },
    });
  },
});
