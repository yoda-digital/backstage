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
import { NotFoundError } from '@backstage/errors';
import {
  CatalogBuilderMode,
  CatalogBuilderProviderId,
  CatalogBuilderJobStatus,
  IngestionJob,
  IngestionJobError,
} from '../types';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-catalog-builder-backend',
  'migrations',
);

interface JobRow {
  id: string;
  provider: string;
  organization: string;
  mode: string;
  status: string;
  total_repos: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: string | IngestionJobError[];
  created_by: string;
  created_at: string;
  completed_at: string | null;
}

/** @internal */
export interface CreateJobRequest {
  provider: CatalogBuilderProviderId;
  organization: string;
  mode: CatalogBuilderMode;
  totalRepos: number;
  createdBy: string;
}

/** @internal */
export interface JobProgressUpdate {
  processed?: number;
  succeeded?: number;
  failed?: number;
  status?: CatalogBuilderJobStatus;
  error?: IngestionJobError;
}

/**
 * Stores and updates the progress of catalog-builder ingestion jobs.
 *
 * @internal
 */
export class JobStore {
  private constructor(private readonly db: Knex) {}

  static async create(options: { database: Knex }): Promise<JobStore> {
    await options.database.migrate.latest({
      directory: migrationsDir,
    tableName: 'knex_migrations_catalog_builder',
    });
    return new JobStore(options.database);
  }

  async createJob(request: CreateJobRequest): Promise<IngestionJob> {
    const id = randomUUID();
    await this.db('catalog_builder_jobs').insert({
      id,
      provider: request.provider,
      organization: request.organization,
      mode: request.mode,
      status: 'pending',
      total_repos: request.totalRepos,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: JSON.stringify([]),
      created_by: request.createdBy,
    });
    return (await this.getJob(id))!;
  }

  async getJob(id: string): Promise<IngestionJob | undefined> {
    const row = await this.db<JobRow>('catalog_builder_jobs')
      .where('id', id)
      .first();
    return row ? this.rowToJob(row) : undefined;
  }

  async listJobs(): Promise<IngestionJob[]> {
    const rows = await this.db<JobRow>('catalog_builder_jobs')
      .select('*')
      .orderBy('seq', 'desc');
    return rows.map(row => this.rowToJob(row));
  }

  async updateProgress(id: string, update: JobProgressUpdate): Promise<void> {
    const job = await this.getJob(id);
    if (!job) {
      throw new NotFoundError(`No catalog-builder job found with id ${id}`);
    }

    const patch: Record<string, unknown> = {};
    if (update.processed !== undefined) {
      patch.processed = update.processed;
    }
    if (update.succeeded !== undefined) {
      patch.succeeded = update.succeeded;
    }
    if (update.failed !== undefined) {
      patch.failed = update.failed;
    }
    if (update.status !== undefined) {
      patch.status = update.status;
      if (update.status === 'completed' || update.status === 'failed') {
        patch.completed_at = new Date();
      }
    }
    if (update.error !== undefined) {
      patch.errors = JSON.stringify([...job.errors, update.error]);
    }

    if (Object.keys(patch).length === 0) {
      return;
    }

    await this.db('catalog_builder_jobs').where('id', id).update(patch);
  }

  private rowToJob(row: JobRow): IngestionJob {
    const errors =
      typeof row.errors === 'string' ? JSON.parse(row.errors) : row.errors;
    return {
      id: row.id,
      provider: row.provider as CatalogBuilderProviderId,
      organization: row.organization,
      mode: row.mode as CatalogBuilderMode,
      status: row.status as CatalogBuilderJobStatus,
      totalRepos: row.total_repos,
      processed: row.processed,
      succeeded: row.succeeded,
      failed: row.failed,
      errors: errors ?? [],
      createdBy: row.created_by,
      createdAt: new Date(row.created_at).toISOString(),
      completedAt: row.completed_at
        ? new Date(row.completed_at).toISOString()
        : undefined,
    };
  }
}
