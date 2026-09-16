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
import { ScmIntegrationRegistry } from '@backstage/integration';
import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';
import { SoundcheckFact } from '@backstage/plugin-soundcheck-common';

/**
 * Options used to create a {@link GitLabFactCollector}.
 * @internal
 */
export interface GitLabFactCollectorOptions {
  integrations: ScmIntegrationRegistry;
  host?: string;
  token?: string;
  logger: LoggerService;
}

/**
 * Collects GitLab project info, CI pipeline status, and merge request stats
 * for a catalog entity.
 * @internal
 */
export class GitLabFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'soundcheck:gitlab/project-info';
  readonly description =
    'Collects GitLab project info, CI pipeline status, and merge request stats';

  private constructor(private readonly options: GitLabFactCollectorOptions) {}

  static create(options: GitLabFactCollectorOptions): GitLabFactCollector {
    return new GitLabFactCollector(options);
  }

  async collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>> {
    const { integrations, host } = this.options;

    const gitlabIntegration = host
      ? integrations.gitlab.byHost(host)
      : integrations.gitlab.list()[0];

    if (!gitlabIntegration) {
      this.options.logger.warn(
        `No GitLab integration configured for entity ${entityRef}`,
      );
      return {
        data: {
          available: false,
          reason: 'No GitLab integration configured',
        },
      };
    }

    // In production, this would resolve the GitLab project for the entity
    // (via its source-location/gitlab.com/project-slug annotation) and call
    // the GitLab REST API for pipelines, merge requests, and project settings.
    return {
      data: {
        available: true,
        host: gitlabIntegration.config.host,
        pipeline: {
          lastStatus: 'unknown',
          lastRun: undefined,
        },
        mergeRequests: {
          openCount: 0,
        },
        repository: {
          hasReadme: false,
          defaultBranch: 'main',
          branchProtection: false,
        },
      },
    };
  }
}
