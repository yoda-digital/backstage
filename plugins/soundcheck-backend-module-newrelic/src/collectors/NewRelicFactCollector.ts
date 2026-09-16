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
 * Options used to create a {@link NewRelicFactCollector}.
 * @internal
 */
export interface NewRelicFactCollectorOptions {
  baseUrl: string;
  apiKey: string;
  logger: LoggerService;
}

interface NewRelicApplication {
  application?: {
    application_summary?: {
      apdex_score?: number;
      error_rate?: number;
      throughput?: number;
    };
  };
}

/**
 * Collects apdex score, error rate, and throughput from New Relic for the
 * application associated with an entity's component.
 * @internal
 */
export class NewRelicFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'soundcheck:newrelic/app-metrics';
  readonly description =
    'Collects apdex score, error rate, and throughput from New Relic';

  private constructor(private readonly options: NewRelicFactCollectorOptions) {}

  static create(options: NewRelicFactCollectorOptions): NewRelicFactCollector {
    return new NewRelicFactCollector(options);
  }

  async collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>> {
    const { baseUrl, apiKey, logger } = this.options;
    const applicationName = entityRef.split('/').pop() ?? entityRef;

    try {
      const url = new URL('/v2/applications.json', baseUrl);
      url.searchParams.set('filter[name]', applicationName);

      const response = await fetch(url, {
        headers: {
          'X-Api-Key': apiKey,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return {
          data: {
            available: false,
            reason: `New Relic API returned ${response.status}`,
          },
        };
      }

      const body = (await response.json()) as {
        applications?: NewRelicApplication['application'][];
      };
      const application = body.applications?.[0];
      const summary = application?.application_summary;

      return {
        data: {
          available: true,
          apdexScore: summary?.apdex_score ?? 0,
          errorRate: summary?.error_rate ?? 0,
          throughput: summary?.throughput ?? 0,
        },
      };
    } catch (error) {
      logger.warn(
        `Failed to collect New Relic facts for ${entityRef}: ${error}`,
      );
      return {
        data: {
          available: false,
          reason: 'Failed to reach the New Relic API',
        },
      };
    }
  }
}
