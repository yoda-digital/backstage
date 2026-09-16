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
 * Configuration for a single generic HTTP fact collector.
 * @internal
 */
export interface HttpFactCollectorEndpoint {
  factRef: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  jsonPath?: string;
}

/**
 * Options used to create an {@link HttpFactCollector}.
 * @internal
 */
export interface HttpFactCollectorOptions {
  endpoint: HttpFactCollectorEndpoint;
  logger: LoggerService;
}

function resolveJsonPath(data: unknown, jsonPath: string | undefined): unknown {
  if (!jsonPath) {
    return data;
  }
  return jsonPath
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object'
          ? (value as Record<string, unknown>)[key]
          : undefined,
      data,
    );
}

/**
 * A generic fact collector that fetches JSON data from an arbitrary HTTP
 * endpoint. Its `url` may contain an `{entityRef}` placeholder.
 * @internal
 */
export class HttpFactCollector implements SoundcheckFactCollector {
  readonly factRef: string;
  readonly description: string;

  private constructor(private readonly options: HttpFactCollectorOptions) {
    this.factRef = options.endpoint.factRef;
    this.description = `HTTP fact collector for ${options.endpoint.url}`;
  }

  static create(options: HttpFactCollectorOptions): HttpFactCollector {
    return new HttpFactCollector(options);
  }

  async collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>> {
    const { endpoint, logger } = this.options;
    const url = endpoint.url.replace(
      '{entityRef}',
      encodeURIComponent(entityRef),
    );

    try {
      const response = await fetch(url, {
        method: endpoint.method ?? 'GET',
        headers: endpoint.headers,
      });

      if (!response.ok) {
        return {
          data: {
            available: false,
            status: response.status,
            reason: response.statusText,
          },
        };
      }

      const body = await response.json();
      const value = resolveJsonPath(body, endpoint.jsonPath);

      return {
        data: {
          available: true,
          value,
        },
      };
    } catch (error) {
      logger.warn(
        `Failed to collect HTTP facts from ${url} for ${entityRef}: ${error}`,
      );
      return {
        data: {
          available: false,
          reason: 'Failed to reach the configured HTTP endpoint',
        },
      };
    }
  }
}
