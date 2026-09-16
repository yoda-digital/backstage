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
import path from 'node:path';
import fs from 'node:fs/promises';
import { NpmShiftConfig } from '@backstage/plugin-fleetshift-common';
import type { ShiftExecutor, ShiftExecutorContext } from './ShiftEngine';

const execFileAsync = promisify(execFile);

/**
 * Executes `npm-package` shifts: bumps a dependency's version in
 * `package.json`, runs `npm install`, optionally applies a codemod, runs the
 * repository's test suite, and opens a merge/pull request with the result.
 *
 * This transformation is fully deterministic and does not involve the AI
 * Gateway.
 *
 * @internal
 */
export class NpmShiftExecutor implements ShiftExecutor {
  async execute(context: ShiftExecutorContext): Promise<{ mrUrl: string }> {
    const config = context.shift.config as NpmShiftConfig;

    await context.setStatus('transforming');
    await context.log(
      'info',
      `Updating ${config.packageName} from ${config.fromVersion} to ${config.toVersion}`,
    );
    await this.bumpDependency(context, config);

    await context.log('info', 'Running npm install');
    await this.runCommand(context, 'npm', ['install']);

    if (config.applyCodemods) {
      await context.log('info', `Applying codemod for ${config.packageName}`);
      try {
        await this.runCommand(context, 'npx', [
          '--yes',
          `${config.packageName}-codemod`,
          `--to=${config.toVersion}`,
          '.',
        ]);
      } catch (error) {
        await context.log(
          'warn',
          `Codemod for ${config.packageName} failed or is unavailable: ${error}`,
        );
      }
    }

    await context.setStatus('testing');
    await context.log('info', 'Running test suite');
    await this.runCommand(context, 'npm', ['test', '--if-present']);

    await context.recordDiffFromWorkDir();

    await context.setStatus('creating_pr');
    const mrUrl = await context.provider.createMergeRequest({
      target: context.target,
      workDir: context.workDir,
      title: context.shift.title,
      description: `Automated by Fleetshift: bump ${config.packageName} from ${config.fromVersion} to ${config.toVersion}`,
      branch: `fleetshift/${context.shift.id}`,
    });
    return { mrUrl };
  }

  private async bumpDependency(
    context: ShiftExecutorContext,
    config: NpmShiftConfig,
  ): Promise<void> {
    const packageJsonPath = path.join(context.workDir, 'package.json');
    const raw = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(raw);

    let updated = false;
    for (const field of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
    ]) {
      if (packageJson[field]?.[config.packageName]) {
        packageJson[field][config.packageName] = config.toVersion;
        updated = true;
      }
    }
    if (!updated) {
      await context.log(
        'warn',
        `${config.packageName} was not found in package.json dependencies`,
      );
      return;
    }
    await fs.writeFile(
      packageJsonPath,
      `${JSON.stringify(packageJson, undefined, 2)}\n`,
      'utf-8',
    );
  }

  private async runCommand(
    context: ShiftExecutorContext,
    command: string,
    args: string[],
  ): Promise<void> {
    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        cwd: context.workDir,
        maxBuffer: 10 * 1024 * 1024,
      });
      if (stdout.trim()) {
        await context.log('info', stdout.trim());
      }
      if (stderr.trim()) {
        await context.log('warn', stderr.trim());
      }
    } catch (error) {
      await context.log(
        'error',
        `Command failed: ${command} ${args.join(' ')}: ${error}`,
      );
      throw error;
    }
  }
}
