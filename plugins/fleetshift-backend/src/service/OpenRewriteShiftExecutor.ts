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
import { OpenRewriteShiftConfig } from '@backstage/plugin-fleetshift-common';
import type { ShiftExecutor, ShiftExecutorContext } from './ShiftEngine';

const execFileAsync = promisify(execFile);

/**
 * Executes `openrewrite` shifts: applies a Java/Kotlin OpenRewrite recipe
 * against the target repository via Maven or Gradle (whichever build file
 * is present), runs the repository's test suite, and opens a merge/pull
 * request with the result.
 *
 * This transformation runs entirely via the OpenRewrite CLI/plugin and does
 * not involve the AI Gateway. It requires a Java runtime on the execution
 * node.
 *
 * @internal
 */
export class OpenRewriteShiftExecutor implements ShiftExecutor {
  async execute(context: ShiftExecutorContext): Promise<{ mrUrl: string }> {
    const config = context.shift.config as OpenRewriteShiftConfig;
    const buildTool = await this.detectBuildTool(context.workDir);

    await context.setStatus('transforming');
    await context.log(
      'info',
      `Applying OpenRewrite recipe ${config.recipeName}@${config.recipeVersion} via ${buildTool}`,
    );
    await this.runRecipe(context, config, buildTool);

    await context.setStatus('testing');
    await context.log('info', 'Running test suite');
    await this.runTests(context, buildTool);

    await context.recordDiffFromWorkDir();

    await context.setStatus('creating_pr');
    const mrUrl = await context.provider.createMergeRequest({
      target: context.target,
      workDir: context.workDir,
      title: context.shift.title,
      description: `Automated by Fleetshift: apply OpenRewrite recipe ${config.recipeName}@${config.recipeVersion}`,
      branch: `fleetshift/${context.shift.id}`,
    });
    return { mrUrl };
  }

  private async detectBuildTool(workDir: string): Promise<'maven' | 'gradle'> {
    try {
      await fs.access(path.join(workDir, 'pom.xml'));
      return 'maven';
    } catch {
      return 'gradle';
    }
  }

  private async runRecipe(
    context: ShiftExecutorContext,
    config: OpenRewriteShiftConfig,
    buildTool: 'maven' | 'gradle',
  ): Promise<void> {
    if (buildTool === 'maven') {
      await this.runCommand(context, 'mvn', [
        '-q',
        `-Drewrite.activeRecipes=${config.recipeName}`,
        '-Drewrite.recipeArtifactCoordinates=:*:*',
        `org.openrewrite.maven:rewrite-maven-plugin:${config.recipeVersion}:run`,
      ]);
    } else {
      await this.runCommand(context, './gradlew', [
        '--quiet',
        'rewriteRun',
        `-DactiveRecipe=${config.recipeName}`,
      ]);
    }
  }

  private async runTests(
    context: ShiftExecutorContext,
    buildTool: 'maven' | 'gradle',
  ): Promise<void> {
    if (buildTool === 'maven') {
      await this.runCommand(context, 'mvn', ['-q', 'test']);
    } else {
      await this.runCommand(context, './gradlew', ['--quiet', 'test']);
    }
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
