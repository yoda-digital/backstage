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
  AccessRequestComment,
  DatasetAccessRequest,
} from '@backstage/plugin-data-experience-common';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-data-experience-backend',
  'migrations',
);

interface AccessRequestRow {
  id: string;
  dataset_ref: string;
  requester_ref: string;
  use_case: string;
  status: 'pending' | 'approved' | 'denied';
  conversation: string | AccessRequestComment[];
  created_at: string | Date;
  resolved_at: string | Date | null;
}

/**
 * Persists {@link DatasetAccessRequest}s, including their approval status
 * and discussion thread.
 *
 * @internal
 */
export class AccessRequestStore {
  private constructor(private readonly db: Knex) {}

  static async create(options: {
    database: Knex;
  }): Promise<AccessRequestStore> {
    await options.database.migrate.latest({
      directory: migrationsDir,
    tableName: 'knex_migrations_data_exp_access',
    });
    return new AccessRequestStore(options.database);
  }

  async create(
    datasetRef: string,
    requestedBy: string,
    reason: string,
  ): Promise<DatasetAccessRequest> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const row: AccessRequestRow = {
      id,
      dataset_ref: datasetRef,
      requester_ref: requestedBy,
      use_case: reason,
      status: 'pending',
      conversation: JSON.stringify([]),
      created_at: now,
      resolved_at: null,
    };
    await this.db('data_access_requests').insert(row);
    return this.rowToRequest(row);
  }

  async get(id: string): Promise<DatasetAccessRequest | undefined> {
    const row = await this.db<AccessRequestRow>('data_access_requests')
      .where({ id })
      .first();
    return row ? this.rowToRequest(row) : undefined;
  }

  async list(datasetRef?: string): Promise<DatasetAccessRequest[]> {
    let query = this.db<AccessRequestRow>('data_access_requests').select('*');
    if (datasetRef) {
      query = query.where({ dataset_ref: datasetRef });
    }
    const rows = await query.orderBy('created_at', 'desc');
    return rows.map(row => this.rowToRequest(row));
  }

  async setStatus(
    id: string,
    status: 'approved' | 'denied',
  ): Promise<DatasetAccessRequest> {
    const resolvedAt = new Date().toISOString();
    const updated = await this.db('data_access_requests')
      .where({ id })
      .update({ status, resolved_at: resolvedAt });
    if (updated === 0) {
      throw new NotFoundError(`No access request found with id ${id}`);
    }
    return (await this.get(id))!;
  }

  async addComment(
    id: string,
    comment: AccessRequestComment,
  ): Promise<DatasetAccessRequest> {
    const existing = await this.get(id);
    if (!existing) {
      throw new NotFoundError(`No access request found with id ${id}`);
    }
    const conversation = [...existing.conversation, comment];
    await this.db('data_access_requests')
      .where({ id })
      .update({ conversation: JSON.stringify(conversation) });
    return (await this.get(id))!;
  }

  private rowToRequest(row: AccessRequestRow): DatasetAccessRequest {
    const conversation =
      typeof row.conversation === 'string'
        ? JSON.parse(row.conversation)
        : row.conversation;
    return {
      id: row.id,
      datasetRef: row.dataset_ref,
      requestedBy: row.requester_ref,
      reason: row.use_case,
      status: row.status,
      conversation,
      createdAt: new Date(row.created_at).toISOString(),
      resolvedAt: row.resolved_at
        ? new Date(row.resolved_at).toISOString()
        : undefined,
    };
  }
}
