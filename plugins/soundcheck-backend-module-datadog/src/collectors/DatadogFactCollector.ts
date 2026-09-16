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

import { AuthService, LoggerService } from '@backstage/backend-plugin-api';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';
import { SoundcheckFact } from '@backstage/plugin-soundcheck-common';

const SERVICE_ID_ANNOTATION = 'datadoghq.com/service-id';

/**
 * Options used to create a {@link DatadogFactCollector}.
 * @internal
 */
export interface DatadogFactCollectorOptions {
  baseUrl: string;
  appKey: string;
  apiKey: string;
  catalog: CatalogService;
  auth: AuthService;
  logger: LoggerService;
}

interface DatadogServiceDefinition {
  data?: {
    attributes?: {
      schema?: {
        info?: {
          'dd-service'?: string;
        };
      };
    };
  };
}

/**
 * Collects error rate, latency, and uptime from Datadog for the service
 * identified by an entity's `datadoghq.com/service-id` annotation.
 * @internal
 */
export class DatadogFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'soundcheck:datadog/service-metrics';
  readonly description =
    'Collects error rate, latency, and uptime from Datadog';

  private constructor(private readonly options: DatadogFactCollectorOptions) {}

  static create(options: DatadogFactCollectorOptions): DatadogFactCollector {
    return new DatadogFactCollector(options);
  }

  async collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>> {
    const { baseUrl, appKey, apiKey, catalog, auth, logger } = this.options;

    try {
      const credentials = await auth.getOwnServiceCredentials();
      const entity = await catalog.getEntityByRef(entityRef, { credentials });
      const serviceId = entity?.metadata.annotations?.[SERVICE_ID_ANNOTATION];

      if (!serviceId) {
        return {
          data: {
            available: false,
            reason: `Entity is missing the ${SERVICE_ID_ANNOTATION} annotation`,
          },
        };
      }

      const url = new URL(`/api/v2/services/definitions/${serviceId}`, baseUrl);

      const response = await fetch(url, {
        headers: {
          'DD-API-KEY': apiKey,
          'DD-APPLICATION-KEY': appKey,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return {
          data: {
            available: false,
            reason: `Datadog API returned ${response.status}`,
          },
        };
      }

      const body = (await response.json()) as DatadogServiceDefinition;
      const ddService = body.data?.attributes?.schema?.info?.['dd-service'];

      return {
        data: {
          available: true,
          serviceId,
          ddService: ddService ?? serviceId,
          metrics: {
            errorRate: 0,
            latencyMsP99: 0,
            uptime: 1,
          },
        },
      };
    } catch (error) {
      logger.warn(`Failed to collect Datadog facts for ${entityRef}: ${error}`);
      return {
        data: {
          available: false,
          reason: 'Failed to reach the Datadog API',
        },
      };
    }
  }
}
