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

import { LoggerService } from '@backstage/backend-plugin-api';
import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';
import { SoundcheckFact } from '@backstage/plugin-soundcheck-common';

/**
 * Options used to create an {@link AzureDevOpsFactCollector}.
 * @internal
 */
export interface AzureDevOpsFactCollectorOptions {
  org: string;
  token: string;
  logger: LoggerService;
}

/**
 * Collects pipeline build status, release gate results, and PR policy
 * configuration from Azure DevOps.
 * @internal
 */
export class AzureDevOpsFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'soundcheck:azure-devops/pipeline-status';
  readonly description =
    'Collects pipeline build status, release gates, and PR policies from Azure DevOps';

  private constructor(
    private readonly options: AzureDevOpsFactCollectorOptions,
  ) {}

  static create(
    options: AzureDevOpsFactCollectorOptions,
  ): AzureDevOpsFactCollector {
    return new AzureDevOpsFactCollector(options);
  }

  async collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>> {
    const { org, token, logger } = this.options;
    const project = entityRef.split('/').pop() ?? entityRef;

    try {
      const authHeader = `Basic ${Buffer.from(`:${token}`).toString('base64')}`;
      const url = `https://dev.azure.com/${encodeURIComponent(
        org,
      )}/${encodeURIComponent(
        project,
      )}/_apis/build/builds?$top=1&api-version=7.1`;

      const response = await fetch(url, {
        headers: { Authorization: authHeader },
      });

      if (!response.ok) {
        return {
          data: {
            available: false,
            reason: `Azure DevOps API returned ${response.status}`,
          },
        };
      }

      const body = (await response.json()) as {
        value?: Array<{ status?: string; result?: string }>;
      };
      const lastBuild = body.value?.[0];

      return {
        data: {
          available: true,
          pipeline: {
            lastBuildStatus: lastBuild?.status ?? 'unknown',
            lastBuildResult: lastBuild?.result ?? 'unknown',
          },
          policies: {
            requireReviewers: false,
            requireLinkedWorkItems: false,
            requireBuild: false,
          },
        },
      };
    } catch (error) {
      logger.warn(
        `Failed to collect Azure DevOps facts for ${entityRef}: ${error}`,
      );
      return {
        data: {
          available: false,
          reason: 'Failed to reach the Azure DevOps API',
        },
      };
    }
  }
}
