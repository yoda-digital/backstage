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
 * Options used to create a {@link SonarQubeFactCollector}.
 * @internal
 */
export interface SonarQubeFactCollectorOptions {
  baseUrl: string;
  token: string;
  logger: LoggerService;
}

const METRIC_KEYS = [
  'bugs',
  'vulnerabilities',
  'code_smells',
  'coverage',
  'duplicated_lines_density',
  'alert_status',
].join(',');

/**
 * Collects code quality metrics — bugs, vulnerabilities, code smells,
 * coverage, and quality gate status — from the SonarQube Web API.
 * @internal
 */
export class SonarQubeFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'soundcheck:sonarqube/quality-metrics';
  readonly description =
    'Collects code quality metrics and quality gate status from SonarQube';

  private constructor(
    private readonly options: SonarQubeFactCollectorOptions,
  ) {}

  static create(
    options: SonarQubeFactCollectorOptions,
  ): SonarQubeFactCollector {
    return new SonarQubeFactCollector(options);
  }

  async collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>> {
    const { baseUrl, token, logger } = this.options;
    const componentKey = entityRef.split('/').pop() ?? entityRef;

    try {
      const url = new URL('/api/measures/component', baseUrl);
      url.searchParams.set('component', componentKey);
      url.searchParams.set('metricKeys', METRIC_KEYS);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return {
          data: {
            available: false,
            reason: `SonarQube API returned ${response.status}`,
          },
        };
      }

      const body = (await response.json()) as {
        component?: {
          measures?: Array<{ metric: string; value?: string }>;
        };
      };
      const measures = new Map(
        (body.component?.measures ?? []).map(measure => [
          measure.metric,
          measure.value,
        ]),
      );

      return {
        data: {
          available: true,
          qualityGate: measures.get('alert_status') ?? 'unknown',
          metrics: {
            bugs: Number(measures.get('bugs') ?? 0),
            vulnerabilities: Number(measures.get('vulnerabilities') ?? 0),
            codeSmells: Number(measures.get('code_smells') ?? 0),
            coverage: Number(measures.get('coverage') ?? 0),
            duplicatedLinesDensity: Number(
              measures.get('duplicated_lines_density') ?? 0,
            ),
          },
        },
      };
    } catch (error) {
      logger.warn(
        `Failed to collect SonarQube facts for ${entityRef}: ${error}`,
      );
      return {
        data: {
          available: false,
          reason: 'Failed to reach the SonarQube server',
        },
      };
    }
  }
}
