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

import { randomUUID } from 'node:crypto';
import { Knex } from 'knex';
import { resolvePackagePath } from '@backstage/backend-plugin-api';
import { ConflictError, NotFoundError } from '@backstage/errors';
import {
  CreateShiftRequest,
  DiffFile,
  LogEntry,
  Shift,
  ShiftExecution,
  ShiftPlan,
  ShiftStatus,
  ShiftTarget,
  TargetDiff,
  TargetStatus,
  VALID_TRANSITIONS,
} from '@backstage/plugin-fleetshift-common';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-fleetshift-backend',
  'migrations',
);

/**
 * Parses a `jsonb`/`json` column value. Some database drivers (notably
 * `pg`) automatically deserialize JSON columns into objects, while others
 * (SQLite, MySQL) return the raw string, so this accepts either.
 */
function parseJsonColumn<T>(value: unknown): T {
  return typeof value === 'string' ? (JSON.parse(value) as T) : (value as T);
}

/**
 * Normalizes a timestamp column value to an ISO string. Timestamps are
 * written as `Date` objects so each database driver formats them correctly
 * (e.g. MySQL rejects a raw ISO string), but drivers read them back
 * differently (a `Date` for MySQL/Postgres, a string for SQLite).
 */
function toIsoString(value: unknown): string;
function toIsoString(value: null | undefined): undefined;
function toIsoString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return new Date(value as string | Date).toISOString();
}

interface ShiftRow {
  id: string;
  title: string;
  description: string;
  transformation: string;
  shift_type: Shift['shiftType'];
  config: string;
  targets: string;
  status: ShiftStatus;
  plan: string | null;
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
}

interface ExecutionRow {
  id: number;
  shift_id: string;
  target_index: number;
  target_repo_url: string;
  status: ShiftExecution['status'];
  target_status: TargetStatus;
  mr_url: string | null;
  error: string | null;
  diff: string | null;
  started_at: string | Date | null;
  completed_at: string | Date | null;
}

interface LogRow {
  id: number;
  shift_id: string;
  target_index: number;
  level: LogEntry['level'];
  message: string;
  created_at: string | Date;
}

/** @internal */
export class ShiftStore {
  private constructor(private readonly db: Knex) {}

  static async create(options: { database: Knex }): Promise<ShiftStore> {
    await options.database.migrate.latest({
      directory: migrationsDir,
    tableName: 'knex_migrations_fleetshift',
    });
    return new ShiftStore(options.database);
  }

  async createShift(
    request: CreateShiftRequest,
    createdBy: string,
  ): Promise<Shift> {
    const id = randomUUID();
    const now = new Date();
    await this.db('fleetshift_shifts').insert({
      id,
      title: request.title,
      description: request.description,
      transformation: request.transformation,
      shift_type: request.shiftType,
      config: JSON.stringify(request.config),
      targets: JSON.stringify(request.targets),
      status: 'created',
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    });
    for (const [targetIndex, target] of request.targets.entries()) {
      await this.db('fleetshift_executions').insert({
        shift_id: id,
        target_index: targetIndex,
        target_repo_url: target.repoUrl,
        status: 'pending',
        target_status: 'queued',
      });
    }
    return (await this.getShift(id))!;
  }

  async getShift(id: string): Promise<Shift | undefined> {
    const row = await this.db<ShiftRow>('fleetshift_shifts')
      .where('id', id)
      .first();
    if (!row) {
      return undefined;
    }
    const executionRows = await this.db<ExecutionRow>('fleetshift_executions')
      .where('shift_id', id)
      .orderBy('target_index', 'asc');
    return this.rowToShift(row, executionRows);
  }

  async listShifts(): Promise<Shift[]> {
    const rows = await this.db<ShiftRow>('fleetshift_shifts')
      .select('*')
      .orderBy('created_at', 'desc');
    const shifts: Shift[] = [];
    for (const row of rows) {
      const executionRows = await this.db<ExecutionRow>('fleetshift_executions')
        .where('shift_id', row.id)
        .orderBy('target_index', 'asc');
      shifts.push(this.rowToShift(row, executionRows));
    }
    return shifts;
  }

  async updateStatus(id: string, status: ShiftStatus): Promise<void> {
    const row = await this.db<ShiftRow>('fleetshift_shifts')
      .where('id', id)
      .first();
    if (!row) {
      throw new NotFoundError(`No shift found with id ${id}`);
    }
    const allowed = VALID_TRANSITIONS[row.status] ?? [];
    if (!allowed.includes(status)) {
      throw new ConflictError(
        `Cannot transition shift ${id} from ${row.status} to ${status}`,
      );
    }
    await this.db('fleetshift_shifts')
      .where('id', id)
      .update({ status, updated_at: new Date() });
  }

  async setPlan(id: string, plan: ShiftPlan): Promise<void> {
    await this.db('fleetshift_shifts')
      .where('id', id)
      .update({
        plan: JSON.stringify(plan),
        updated_at: new Date(),
      });
  }

  /**
   * Marks a target as having started execution: transitions its coarse
   * status to `running` and its {@link TargetStatus} to `cloning`.
   */
  async markTargetStarted(shiftId: string, targetIndex: number): Promise<void> {
    await this.db('fleetshift_executions')
      .where({ shift_id: shiftId, target_index: targetIndex })
      .update({
        status: 'running',
        target_status: 'cloning',
        error: null,
        started_at: new Date(),
        completed_at: null,
      });
  }

  /**
   * Updates the fine-grained {@link TargetStatus} of a single target,
   * without affecting its coarse execution status.
   */
  async updateTargetStatus(
    shiftId: string,
    targetIndex: number,
    targetStatus: TargetStatus,
  ): Promise<void> {
    await this.db('fleetshift_executions')
      .where({ shift_id: shiftId, target_index: targetIndex })
      .update({ target_status: targetStatus });
  }

  async updateExecution(
    shiftId: string,
    targetIndex: number,
    update: {
      status: ShiftExecution['status'];
      targetStatus: TargetStatus;
      mrUrl?: string;
      error?: string;
    },
  ): Promise<void> {
    const completed = ['succeeded', 'failed'].includes(update.status);
    await this.db('fleetshift_executions')
      .where({ shift_id: shiftId, target_index: targetIndex })
      .update({
        status: update.status,
        target_status: update.targetStatus,
        mr_url: update.mrUrl,
        error: update.error,
        completed_at: completed ? new Date() : null,
      });
  }

  async appendLog(
    shiftId: string,
    targetIndex: number,
    level: LogEntry['level'],
    message: string,
  ): Promise<void> {
    await this.db('fleetshift_logs').insert({
      shift_id: shiftId,
      target_index: targetIndex,
      level,
      message,
    });
  }

  async getLogs(shiftId: string, targetIndex: number): Promise<LogEntry[]> {
    const rows = await this.db<LogRow>('fleetshift_logs')
      .where({ shift_id: shiftId, target_index: targetIndex })
      .orderBy('id', 'asc');
    return rows.map(row => ({
      level: row.level,
      message: row.message,
      timestamp: toIsoString(row.created_at),
    }));
  }

  async setDiff(
    shiftId: string,
    targetIndex: number,
    files: DiffFile[],
  ): Promise<void> {
    await this.db('fleetshift_executions')
      .where({ shift_id: shiftId, target_index: targetIndex })
      .update({ diff: JSON.stringify(files) });
  }

  async getDiff(
    shiftId: string,
    targetIndex: number,
  ): Promise<TargetDiff | undefined> {
    const row = await this.db<ExecutionRow>('fleetshift_executions')
      .where({ shift_id: shiftId, target_index: targetIndex })
      .first();
    if (!row) {
      return undefined;
    }
    return {
      targetRepoUrl: row.target_repo_url,
      files: row.diff ? parseJsonColumn<DiffFile[]>(row.diff) : [],
    };
  }

  private rowToShift(row: ShiftRow, executionRows: ExecutionRow[]): Shift {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      transformation: row.transformation,
      shiftType: row.shift_type,
      config: row.config
        ? parseJsonColumn(row.config)
        : ({} as Shift['config']),
      targets: parseJsonColumn<ShiftTarget[]>(row.targets),
      status: row.status,
      plan: row.plan ? parseJsonColumn<ShiftPlan>(row.plan) : undefined,
      executions: executionRows.map(execRow => this.rowToExecution(execRow)),
      createdBy: row.created_by,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
    };
  }

  private rowToExecution(row: ExecutionRow): ShiftExecution {
    return {
      targetIndex: row.target_index,
      targetRepoUrl: row.target_repo_url,
      status: row.status,
      targetStatus: row.target_status,
      mrUrl: row.mr_url ?? undefined,
      error: row.error ?? undefined,
      startedAt: toIsoString(row.started_at),
      completedAt: toIsoString(row.completed_at),
    };
  }
}
