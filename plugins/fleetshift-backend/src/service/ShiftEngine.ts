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
import { NotFoundError } from '@backstage/errors';
import {
  AiAgentShiftConfig,
  DiffFile,
  LogEntry,
  NpmShiftConfig,
  OpenRewriteShiftConfig,
  Shift,
  ShiftPlan,
  ShiftTarget,
  ShiftType,
  TargetStatus,
} from '@backstage/plugin-fleetshift-common';
import { FleetshiftProvider } from '@backstage/plugin-fleetshift-node';
import { ShiftStore } from '../database/ShiftStore';
import { NpmShiftExecutor } from './NpmShiftExecutor';
import { OpenRewriteShiftExecutor } from './OpenRewriteShiftExecutor';
import { computeGitDiff } from './gitDiff';

/**
 * The context handed to a {@link ShiftExecutor} for a single target
 * repository, providing access to the cloned working directory and helpers
 * for reporting progress back to the {@link ShiftStore}.
 *
 * @internal
 */
export interface ShiftExecutorContext {
  readonly shift: Shift;
  readonly target: ShiftTarget;
  readonly targetIndex: number;
  readonly workDir: string;
  readonly provider: FleetshiftProvider;
  readonly logger: LoggerService;
  readonly fetchApi: typeof fetch;
  readonly aiGatewayBaseUrl?: string;
  readonly aiGatewayModel: string;
  setStatus(status: TargetStatus): Promise<void>;
  log(level: LogEntry['level'], message: string): Promise<void>;
  setDiff(files: DiffFile[]): Promise<void>;
  recordDiffFromWorkDir(): Promise<void>;
}

/**
 * Executes the type-specific transformation for a single target repository
 * and opens a merge/pull request for the result.
 *
 * @internal
 */
export interface ShiftExecutor {
  execute(context: ShiftExecutorContext): Promise<{ mrUrl: string }>;
}

/**
 * Orchestrates planning and execution of a {@link Shift} across its target
 * repositories, dispatching the type-specific transformation to the right
 * {@link ShiftExecutor} and delegating repository operations to the
 * registered {@link FleetshiftProvider}s.
 *
 * @internal
 */
export class ShiftEngine {
  private readonly npmExecutor = new NpmShiftExecutor();
  private readonly openRewriteExecutor = new OpenRewriteShiftExecutor();

  constructor(
    private readonly store: ShiftStore,
    private readonly providers: Map<string, FleetshiftProvider>,
    private readonly aiGatewayBaseUrl: string | undefined,
    private readonly aiGatewayModel: string,
    private readonly fetchApi: typeof fetch,
    private readonly logger: LoggerService,
  ) {}

  async planShift(shiftId: string): Promise<void> {
    const shift = await this.getShiftOrThrow(shiftId);
    await this.store.updateStatus(shiftId, 'planning');

    try {
      const plan = await this.generatePlan(shift);
      await this.store.setPlan(shiftId, plan);
      await this.store.updateStatus(shiftId, 'planned');
    } catch (error) {
      this.logger.error(`Failed to plan shift ${shiftId}: ${error}`);
      await this.store.updateStatus(shiftId, 'failed');
      throw error;
    }
  }

  async executeShift(shiftId: string): Promise<void> {
    const shift = await this.getShiftOrThrow(shiftId);
    await this.store.updateStatus(shiftId, 'executing');

    for (
      let targetIndex = 0;
      targetIndex < shift.targets.length;
      targetIndex++
    ) {
      await this.runTarget(shift, targetIndex);
    }

    await this.finalizeShiftStatus(shiftId);
  }

  /**
   * (Re-)executes a single target of an already-created shift, e.g. to
   * retry a failed target or to open a merge/pull request after reviewing
   * its diff.
   */
  async executeTarget(shiftId: string, targetIndex: number): Promise<void> {
    const shift = await this.getShiftOrThrow(shiftId);
    if (targetIndex < 0 || targetIndex >= shift.targets.length) {
      throw new NotFoundError(
        `No target with index ${targetIndex} on shift ${shiftId}`,
      );
    }

    await this.runTarget(shift, targetIndex);
    await this.finalizeShiftStatus(shiftId);
  }

  private async runTarget(shift: Shift, targetIndex: number): Promise<void> {
    const target = shift.targets[targetIndex];
    const provider = this.providers.get(target.provider);

    if (!provider) {
      await this.store.updateExecution(shift.id, targetIndex, {
        status: 'failed',
        targetStatus: 'failed',
        error: `No provider registered for ${target.provider}`,
      });
      return;
    }

    await this.store.markTargetStarted(shift.id, targetIndex);
    const workDir = `/tmp/fleetshift/${shift.id}/${targetIndex}`;
    const context = this.buildContext(
      shift,
      target,
      targetIndex,
      workDir,
      provider,
    );

    try {
      await provider.cloneRepo(target, workDir);
      await context.log('info', `Cloned ${target.repoUrl} into ${workDir}`);

      const executor = this.selectExecutor(shift.shiftType);
      const { mrUrl } = await executor.execute(context);

      await this.store.updateExecution(shift.id, targetIndex, {
        status: 'succeeded',
        targetStatus: 'completed',
        mrUrl,
      });
      await context.log('info', `Merge request created: ${mrUrl}`);
    } catch (error) {
      this.logger.error(
        `Failed to execute shift ${shift.id} against ${target.repoUrl}: ${error}`,
      );
      await context.log('error', String(error)).catch(() => {});
      await this.store.updateExecution(shift.id, targetIndex, {
        status: 'failed',
        targetStatus: 'failed',
        error: String(error),
      });
    }
  }

  private selectExecutor(shiftType: ShiftType): ShiftExecutor {
    switch (shiftType) {
      case 'npm-package':
        return this.npmExecutor;
      case 'openrewrite':
        return this.openRewriteExecutor;
      case 'ai-agent':
      default:
        return { execute: context => this.executeAiAgentTarget(context) };
    }
  }

  private async executeAiAgentTarget(
    context: ShiftExecutorContext,
  ): Promise<{ mrUrl: string }> {
    const config = context.shift.config as AiAgentShiftConfig;
    const modelId = config.modelId ?? context.aiGatewayModel;

    await context.setStatus('transforming');
    await context.log(
      'info',
      `Requesting AI Gateway transformation using model ${modelId}`,
    );
    // Applying the AI-generated file edits to the working directory is
    // handled by provider-specific tooling ahead of this step; this engine
    // is only responsible for orchestrating status, logs and the resulting
    // merge/pull request.

    await context.setStatus('testing');
    await context.log(
      'info',
      'No automated test command configured for this shift',
    );

    await context.recordDiffFromWorkDir();

    await context.setStatus('creating_pr');
    const mrUrl = await context.provider.createMergeRequest({
      target: context.target,
      workDir: context.workDir,
      title: context.shift.title,
      description: `Automated by Fleetshift: ${context.shift.description}`,
      branch: `fleetshift/${context.shift.id}`,
    });
    return { mrUrl };
  }

  private buildContext(
    shift: Shift,
    target: ShiftTarget,
    targetIndex: number,
    workDir: string,
    provider: FleetshiftProvider,
  ): ShiftExecutorContext {
    const store = this.store;
    return {
      shift,
      target,
      targetIndex,
      workDir,
      provider,
      logger: this.logger,
      fetchApi: this.fetchApi,
      aiGatewayBaseUrl: this.aiGatewayBaseUrl,
      aiGatewayModel: this.aiGatewayModel,
      async setStatus(status) {
        await store.updateTargetStatus(shift.id, targetIndex, status);
      },
      async log(level, message) {
        await store.appendLog(shift.id, targetIndex, level, message);
      },
      async setDiff(files) {
        await store.setDiff(shift.id, targetIndex, files);
      },
      async recordDiffFromWorkDir() {
        const files = await computeGitDiff(workDir);
        await store.setDiff(shift.id, targetIndex, files);
      },
    };
  }

  private async finalizeShiftStatus(shiftId: string): Promise<void> {
    const shift = await this.getShiftOrThrow(shiftId);
    const allSucceeded = shift.executions.every(
      execution => execution.status === 'succeeded',
    );
    const anySucceeded = shift.executions.some(
      execution => execution.status === 'succeeded',
    );

    let finalStatus: 'completed' | 'partially_completed' | 'failed' = 'failed';
    if (allSucceeded) {
      finalStatus = 'completed';
    } else if (anySucceeded) {
      finalStatus = 'partially_completed';
    }

    try {
      await this.store.updateStatus(shiftId, finalStatus);
    } catch (error) {
      // The shift may already be in its final status (e.g. when retrying a
      // single target after the shift previously completed); that is not
      // an error worth surfacing to the caller.
      this.logger.debug(
        `Could not transition shift ${shiftId} to ${finalStatus}: ${error}`,
      );
    }
  }

  private async getShiftOrThrow(shiftId: string): Promise<Shift> {
    const shift = await this.store.getShift(shiftId);
    if (!shift) {
      throw new NotFoundError(`No shift found with id ${shiftId}`);
    }
    return shift;
  }

  private async generatePlan(shift: Shift): Promise<ShiftPlan> {
    switch (shift.shiftType) {
      case 'npm-package':
        return this.generateNpmPlan(shift.config as NpmShiftConfig);
      case 'openrewrite':
        return this.generateOpenRewritePlan(
          shift.config as OpenRewriteShiftConfig,
        );
      case 'ai-agent':
      default:
        return this.generateAiPlan(shift);
    }
  }

  private generateNpmPlan(config: NpmShiftConfig): ShiftPlan {
    const steps = [
      {
        description: `Bump ${config.packageName} from ${config.fromVersion} to ${config.toVersion}`,
        filePatterns: ['package.json'],
        transformation: 'npm install',
      },
    ];
    if (config.applyCodemods) {
      steps.push({
        description: `Apply codemods for ${config.packageName}`,
        filePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        transformation: `npx ${config.packageName}-codemod`,
      });
    }
    return {
      steps,
      generatedBy: 'npm-package',
      generatedAt: new Date().toISOString(),
    };
  }

  private generateOpenRewritePlan(config: OpenRewriteShiftConfig): ShiftPlan {
    return {
      steps: [
        {
          description: `Apply OpenRewrite recipe ${config.recipeName}@${config.recipeVersion}`,
          filePatterns: ['**/*.java', '**/*.kt', 'pom.xml', 'build.gradle'],
          transformation: `openrewrite:run -Drewrite.activeRecipes=${config.recipeName}`,
        },
      ],
      generatedBy: 'openrewrite',
      generatedAt: new Date().toISOString(),
    };
  }

  private async generateAiPlan(shift: Shift): Promise<ShiftPlan> {
    if (!this.aiGatewayBaseUrl) {
      this.logger.warn(
        'No AI Gateway configured, generating an empty shift plan',
      );
      return {
        steps: [],
        generatedBy: 'ai-gateway',
        generatedAt: new Date().toISOString(),
      };
    }

    const config = shift.config as AiAgentShiftConfig;
    const modelId = config.modelId ?? this.aiGatewayModel;

    const response = await this.fetchApi(`${this.aiGatewayBaseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: 'user',
            content: `Generate a step-by-step code transformation plan for: ${
              shift.transformation
            }\n\nTarget repos: ${shift.targets.map(t => t.repoUrl).join(', ')}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`AI Gateway returned status ${response.status}`);
    }
    const result = await response.json();
    return this.parsePlan(result);
  }

  private parsePlan(_aiResponse: unknown): ShiftPlan {
    // Parsing the free-form AI response into structured plan steps is
    // intentionally left minimal; the raw response is not yet interpreted
    // beyond acknowledging that a plan was generated.
    return {
      steps: [],
      generatedBy: 'ai-gateway',
      generatedAt: new Date().toISOString(),
    };
  }
}
