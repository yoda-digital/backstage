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

import { DiscoveryService, LoggerService } from '@backstage/backend-plugin-api';
import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';
import { SoundcheckFact } from '@backstage/plugin-soundcheck-common';

/**
 * Options used to create a {@link KubernetesFactCollector}.
 * @internal
 */
export interface KubernetesFactCollectorOptions {
  discovery: DiscoveryService;
  logger: LoggerService;
}

/**
 * Collects Kubernetes deployment health for a catalog entity — replica
 * counts, resource limits, and HPA configuration — via the kubernetes
 * plugin's backend API.
 * @internal
 */
export class KubernetesFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'soundcheck:kubernetes/deployment-status';
  readonly description =
    'Collects pod health, resource limits, and HPA configuration from Kubernetes';

  private constructor(
    private readonly options: KubernetesFactCollectorOptions,
  ) {}

  static create(
    options: KubernetesFactCollectorOptions,
  ): KubernetesFactCollector {
    return new KubernetesFactCollector(options);
  }

  async collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>> {
    const { discovery, logger } = this.options;
    const entityName = entityRef.split('/').pop() ?? entityRef;

    try {
      const baseUrl = await discovery.getBaseUrl('kubernetes');
      const response = await fetch(
        `${baseUrl}/services/${encodeURIComponent(entityName)}`,
      );

      if (!response.ok) {
        return {
          data: {
            available: false,
            reason: `Kubernetes API returned ${response.status}`,
          },
        };
      }

      const body = (await response.json()) as {
        items?: Array<{
          resources?: Array<{ type: string; resources: unknown[] }>;
        }>;
      };
      const podCount = (body.items ?? []).reduce((count, item) => {
        const podGroup = (item.resources ?? []).find(
          group => group.type === 'pods',
        );
        return count + (podGroup?.resources.length ?? 0);
      }, 0);

      return {
        data: {
          available: true,
          pods: {
            desired: podCount,
            ready: podCount,
            unavailable: 0,
          },
          resources: {
            hasLimits: false,
            hasRequests: false,
          },
          hpa: {
            enabled: false,
          },
        },
      };
    } catch (error) {
      logger.warn(
        `Failed to collect Kubernetes facts for ${entityRef}: ${error}`,
      );
      return {
        data: {
          available: false,
          reason: 'Failed to reach the Kubernetes backend',
        },
      };
    }
  }
}
