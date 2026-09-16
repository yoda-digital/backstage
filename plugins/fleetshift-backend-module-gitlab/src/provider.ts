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

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { LoggerService } from '@backstage/backend-plugin-api';
import { FleetshiftProvider } from '@backstage/plugin-fleetshift-node';
import { ShiftTarget } from '@backstage/plugin-fleetshift-common';

const exec = promisify(execFile);

/**
 * A {@link FleetshiftProvider} implementation that clones repositories from
 * and opens merge requests against GitLab.
 *
 * @public
 */
export class GitLabFleetshiftProvider implements FleetshiftProvider {
  readonly providerId = 'gitlab' as const;

  constructor(
    private readonly host: string,
    private readonly token: string,
    private readonly logger: LoggerService,
  ) {}

  async cloneRepo(target: ShiftTarget, workDir: string): Promise<void> {
    const cloneUrl = target.repoUrl.replace(
      'https://',
      `https://oauth2:${this.token}@`,
    );
    await exec('git', [
      'clone',
      '--depth=1',
      '--branch',
      target.branch,
      cloneUrl,
      workDir,
    ]);
  }

  async createMergeRequest(options: {
    target: ShiftTarget;
    workDir: string;
    title: string;
    description: string;
    branch: string;
  }): Promise<string> {
    await exec('git', ['checkout', '-b', options.branch], {
      cwd: options.workDir,
    });
    await exec('git', ['add', '.'], { cwd: options.workDir });
    await exec('git', ['commit', '-m', options.title], {
      cwd: options.workDir,
    });
    await exec('git', ['push', 'origin', options.branch], {
      cwd: options.workDir,
    });

    const projectPath = new URL(options.target.repoUrl).pathname
      .slice(1)
      .replace(/\.git$/, '');
    const encodedPath = encodeURIComponent(projectPath);
    const res = await fetch(
      `https://${this.host}/api/v4/projects/${encodedPath}/merge_requests`,
      {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': this.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_branch: options.branch,
          target_branch: options.target.branch,
          title: options.title,
          description: options.description,
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to create GitLab merge request: ${res.status}`);
    }
    const mr = (await res.json()) as { web_url: string };
    return mr.web_url;
  }

  async getMrStatus(mrUrl: string): Promise<'open' | 'merged' | 'closed'> {
    const match = mrUrl.match(
      /^https?:\/\/([^/]+)\/(.+)\/-\/merge_requests\/(\d+)/,
    );
    if (!match) {
      this.logger.warn(`Could not parse GitLab merge request URL: ${mrUrl}`);
      return 'open';
    }
    const [, , projectPath, mrIid] = match;
    const encodedPath = encodeURIComponent(projectPath);
    const res = await fetch(
      `https://${this.host}/api/v4/projects/${encodedPath}/merge_requests/${mrIid}`,
      { headers: { 'PRIVATE-TOKEN': this.token } },
    );
    if (!res.ok) {
      this.logger.warn(
        `GitLab API error while checking MR status: ${res.status}`,
      );
      return 'open';
    }
    const mr = (await res.json()) as { state: string };
    if (mr.state === 'merged') return 'merged';
    if (mr.state === 'closed') return 'closed';
    return 'open';
  }
}
