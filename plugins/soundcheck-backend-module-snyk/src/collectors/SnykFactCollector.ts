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
 * Options used to create a {@link SnykFactCollector}.
 * @internal
 */
export interface SnykFactCollectorOptions {
  baseUrl: string;
  token: string;
  orgId: string;
  logger: LoggerService;
}

interface SnykIssue {
  issueData?: { severity?: string };
}

/**
 * Collects critical, high, medium, and low vulnerability counts from Snyk
 * for the project associated with an entity's component.
 * @internal
 */
export class SnykFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'soundcheck:snyk/vulnerability-metrics';
  readonly description =
    'Collects critical, high, medium, and low vulnerability counts from Snyk';

  private constructor(private readonly options: SnykFactCollectorOptions) {}

  static create(options: SnykFactCollectorOptions): SnykFactCollector {
    return new SnykFactCollector(options);
  }

  async collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>> {
    const { baseUrl, token, orgId, logger } = this.options;
    const projectName = entityRef.split('/').pop() ?? entityRef;

    try {
      const url = new URL(`/rest/orgs/${orgId}/issues`, baseUrl);
      url.searchParams.set('version', '2024-10-15');
      url.searchParams.set('project_name', projectName);

      const response = await fetch(url, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.api+json',
        },
      });

      if (!response.ok) {
        return {
          data: {
            available: false,
            reason: `Snyk API returned ${response.status}`,
          },
        };
      }

      const body = (await response.json()) as { data?: SnykIssue[] };
      const issues = body.data ?? [];

      const countBySeverity = (severity: string) =>
        issues.filter(issue => issue.issueData?.severity === severity).length;

      return {
        data: {
          available: true,
          vulnerabilities: {
            critical: countBySeverity('critical'),
            high: countBySeverity('high'),
            medium: countBySeverity('medium'),
            low: countBySeverity('low'),
          },
        },
      };
    } catch (error) {
      logger.warn(`Failed to collect Snyk facts for ${entityRef}: ${error}`);
      return {
        data: {
          available: false,
          reason: 'Failed to reach the Snyk API',
        },
      };
    }
  }
}
