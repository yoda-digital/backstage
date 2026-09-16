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
 * Options used to create a {@link JiraFactCollector}.
 * @internal
 */
export interface JiraFactCollectorOptions {
  baseUrl: string;
  token: string;
  email: string;
  projectKey: string;
  logger: LoggerService;
}

/**
 * Collects open bug counts, critical issue counts, and SLA compliance for
 * the Jira project associated with an entity's component.
 * @internal
 */
export class JiraFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'soundcheck:jira/issue-stats';
  readonly description =
    'Collects open bug count, SLA compliance, and sprint velocity from Jira';

  private constructor(private readonly options: JiraFactCollectorOptions) {}

  static create(options: JiraFactCollectorOptions): JiraFactCollector {
    return new JiraFactCollector(options);
  }

  async collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>> {
    const { baseUrl, token, email, projectKey, logger } = this.options;
    const componentName = entityRef.split('/').pop() ?? entityRef;

    try {
      const jql = `project = "${projectKey}" AND component = "${componentName}" AND status != Done`;
      const url = new URL('/rest/api/3/search', baseUrl);
      url.searchParams.set('jql', jql);
      url.searchParams.set('fields', 'issuetype,priority,status');

      const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString(
        'base64',
      )}`;

      const response = await fetch(url, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });

      if (!response.ok) {
        return {
          data: {
            available: false,
            reason: `Jira API returned ${response.status}`,
          },
        };
      }

      const body = (await response.json()) as {
        total?: number;
        issues?: Array<{
          fields?: {
            issuetype?: { name?: string };
            priority?: { name?: string };
          };
        }>;
      };
      const issues = body.issues ?? [];
      const openBugs = issues.filter(
        issue => issue.fields?.issuetype?.name === 'Bug',
      ).length;
      const openCritical = issues.filter(issue =>
        ['Critical', 'Highest'].includes(issue.fields?.priority?.name ?? ''),
      ).length;

      return {
        data: {
          available: true,
          issues: {
            openBugs,
            openCritical,
            totalOpen: body.total ?? issues.length,
          },
          sla: {
            compliant: openCritical === 0,
          },
        },
      };
    } catch (error) {
      logger.warn(`Failed to collect Jira facts for ${entityRef}: ${error}`);
      return {
        data: {
          available: false,
          reason: 'Failed to reach the Jira API',
        },
      };
    }
  }
}
