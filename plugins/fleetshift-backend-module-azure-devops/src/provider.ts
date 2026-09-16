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

interface AzureRepoRef {
  org: string;
  project: string;
  repo: string;
}

/**
 * A {@link FleetshiftProvider} implementation that clones repositories from
 * and opens pull requests against Azure DevOps.
 *
 * @public
 */
export class AzureDevOpsFleetshiftProvider implements FleetshiftProvider {
  readonly providerId = 'azure-devops' as const;

  constructor(
    private readonly token: string,
    private readonly logger: LoggerService,
  ) {}

  private parseRepoUrl(repoUrl: string): AzureRepoRef {
    // Expected shape: https://dev.azure.com/{org}/{project}/_git/{repo}
    const url = new URL(repoUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const gitIndex = parts.indexOf('_git');
    if (gitIndex === -1 || gitIndex < 2) {
      throw new Error(`Unrecognized Azure DevOps repository URL: ${repoUrl}`);
    }
    return {
      org: parts[0],
      project: parts[gitIndex - 1],
      repo: parts[gitIndex + 1],
    };
  }

  private authHeaders(): Record<string, string> {
    const encoded = Buffer.from(`:${this.token}`).toString('base64');
    return {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/json',
    };
  }

  async cloneRepo(target: ShiftTarget, workDir: string): Promise<void> {
    const cloneUrl = target.repoUrl.replace(
      'https://',
      `https://azdo:${this.token}@`,
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

    const { org, project, repo } = this.parseRepoUrl(options.target.repoUrl);
    const res = await fetch(
      `https://dev.azure.com/${org}/${encodeURIComponent(
        project,
      )}/_apis/git/repositories/${encodeURIComponent(
        repo,
      )}/pullrequests?api-version=7.1`,
      {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({
          sourceRefName: `refs/heads/${options.branch}`,
          targetRefName: `refs/heads/${options.target.branch}`,
          title: options.title,
          description: options.description,
        }),
      },
    );
    if (!res.ok) {
      throw new Error(
        `Failed to create Azure DevOps pull request: ${res.status}`,
      );
    }
    const pr = (await res.json()) as {
      pullRequestId: number;
      repository: { webUrl: string };
    };
    return `${pr.repository.webUrl}/pullrequest/${pr.pullRequestId}`;
  }

  async getMrStatus(mrUrl: string): Promise<'open' | 'merged' | 'closed'> {
    const match = mrUrl.match(/\/pullrequest\/(\d+)/);
    if (!match) {
      this.logger.warn(
        `Could not parse Azure DevOps pull request URL: ${mrUrl}`,
      );
      return 'open';
    }
    const [, prId] = match;
    const orgProjectMatch = mrUrl.match(
      /https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)/,
    );
    if (!orgProjectMatch) {
      return 'open';
    }
    const [, org, project, repo] = orgProjectMatch;
    const res = await fetch(
      `https://dev.azure.com/${org}/${encodeURIComponent(
        project,
      )}/_apis/git/repositories/${encodeURIComponent(
        repo,
      )}/pullrequests/${prId}?api-version=7.1`,
      { headers: this.authHeaders() },
    );
    if (!res.ok) {
      this.logger.warn(
        `Azure DevOps API error while checking PR status: ${res.status}`,
      );
      return 'open';
    }
    const pr = (await res.json()) as {
      status: string;
      mergeStatus?: string;
    };
    if (pr.status === 'completed') return 'merged';
    if (pr.status === 'abandoned') return 'closed';
    return 'open';
  }
}
