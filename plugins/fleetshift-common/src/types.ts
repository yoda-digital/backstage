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

/**
 * The lifecycle states of a {@link Shift}.
 *
 * @public
 */
export type ShiftStatus =
  | 'created'
  | 'planning'
  | 'planned'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'partially_completed';

/**
 * The kind of transformation a {@link Shift} applies across its targets.
 *
 * @public
 */
export type ShiftType = 'ai-agent' | 'npm-package' | 'openrewrite';

/**
 * Configuration for a {@link ShiftType} `ai-agent` shift: a free-form prompt
 * executed by an AI Gateway-backed model.
 *
 * @public
 */
export interface AiAgentShiftConfig {
  readonly prompt: string;
  readonly modelId?: string;
}

/**
 * Configuration for a {@link ShiftType} `npm-package` shift: a deterministic
 * npm dependency version bump, optionally followed by codemods.
 *
 * @public
 */
export interface NpmShiftConfig {
  readonly packageName: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly applyCodemods: boolean;
}

/**
 * Configuration for a {@link ShiftType} `openrewrite` shift: a Java/Kotlin
 * transformation applied via an OpenRewrite recipe.
 *
 * @public
 */
export interface OpenRewriteShiftConfig {
  readonly recipeName: string;
  readonly recipeVersion: string;
}

/**
 * The type-specific configuration of a {@link Shift}, discriminated by its
 * {@link ShiftType}.
 *
 * @public
 */
export type ShiftConfig =
  | AiAgentShiftConfig
  | NpmShiftConfig
  | OpenRewriteShiftConfig;

/**
 * The fine-grained execution states of a single {@link ShiftTarget} within a
 * {@link Shift}.
 *
 * @public
 */
export type TargetStatus =
  | 'queued'
  | 'cloning'
  | 'transforming'
  | 'testing'
  | 'creating_pr'
  | 'completed'
  | 'failed';

/**
 * A fleet-wide code change that is planned and executed across a set of
 * target repositories.
 *
 * @public
 */
export interface Shift {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly transformation: string;
  readonly shiftType: ShiftType;
  readonly config: ShiftConfig;
  readonly targets: ShiftTarget[];
  readonly status: ShiftStatus;
  readonly plan?: ShiftPlan;
  readonly executions: ShiftExecution[];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * A single repository targeted by a {@link Shift}.
 *
 * @public
 */
export interface ShiftTarget {
  readonly repoUrl: string;
  readonly branch: string;
  readonly provider: 'gitlab' | 'azure-devops';
}

/**
 * The generated plan for how a {@link Shift} will be applied across its
 * targets.
 *
 * @public
 */
export interface ShiftPlan {
  readonly steps: ShiftPlanStep[];
  readonly generatedBy: string;
  readonly generatedAt: string;
}

/**
 * A single step of a {@link ShiftPlan}.
 *
 * @public
 */
export interface ShiftPlanStep {
  readonly description: string;
  readonly filePatterns: string[];
  readonly transformation: string;
}

/**
 * The execution result of a {@link Shift} against a single target
 * repository.
 *
 * @public
 */
export interface ShiftExecution {
  readonly targetIndex: number;
  readonly targetRepoUrl: string;
  readonly status: 'pending' | 'running' | 'succeeded' | 'failed';
  readonly targetStatus: TargetStatus;
  readonly mrUrl?: string;
  readonly error?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
}

/**
 * A single line of a unified diff hunk.
 *
 * @public
 */
export interface DiffLine {
  readonly type: 'context' | 'add' | 'remove';
  readonly content: string;
  readonly oldLineNumber?: number;
  readonly newLineNumber?: number;
}

/**
 * A contiguous block of changed lines within a {@link DiffFile}.
 *
 * @public
 */
export interface DiffHunk {
  readonly header: string;
  readonly lines: DiffLine[];
}

/**
 * The diff for a single file changed by a {@link Shift} against one target.
 *
 * @public
 */
export interface DiffFile {
  readonly path: string;
  readonly changeType: 'added' | 'modified' | 'deleted';
  readonly hunks: DiffHunk[];
}

/**
 * The full diff produced for a single {@link ShiftTarget}.
 *
 * @public
 */
export interface TargetDiff {
  readonly targetRepoUrl: string;
  readonly files: DiffFile[];
}

/**
 * A single log line emitted while executing a {@link Shift} against a
 * single target.
 *
 * @public
 */
export interface LogEntry {
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly timestamp: string;
}

/**
 * The request payload used to create a new {@link Shift}.
 *
 * @public
 */
export interface CreateShiftRequest {
  readonly title: string;
  readonly description: string;
  readonly transformation: string;
  readonly shiftType: ShiftType;
  readonly config: ShiftConfig;
  readonly targets: ShiftTarget[];
}

/**
 * The valid state transitions for a {@link Shift}, keyed by the current
 * {@link ShiftStatus}.
 *
 * @public
 */
export const VALID_TRANSITIONS: Record<ShiftStatus, ShiftStatus[]> = {
  created: ['planning'],
  planning: ['planned', 'failed'],
  planned: ['executing'],
  executing: ['completed', 'failed', 'partially_completed'],
  completed: [],
  failed: ['created'],
  partially_completed: ['executing'],
};
