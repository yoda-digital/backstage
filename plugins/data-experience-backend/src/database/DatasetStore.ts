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

import { Knex } from 'knex';
import { resolvePackagePath } from '@backstage/backend-plugin-api';
import {
  ColumnMetadata,
  DatasetMetadata,
} from '@backstage/plugin-data-experience-common';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-data-experience-backend',
  'migrations',
);

interface DatasetMetadataRow {
  entity_ref: string;
  columns: string | ColumnMetadata[];
  row_count: string | number | null;
  size_bytes: string | number | null;
  last_updated: string | Date | null;
  collected_at: string | Date;
}

/** @internal */
export class DatasetStore {
  private constructor(private readonly db: Knex) {}

  static async create(options: { database: Knex }): Promise<DatasetStore> {
    await options.database.migrate.latest({
      directory: migrationsDir,
    });
    return new DatasetStore(options.database);
  }

  async getMetadata(entityRef: string): Promise<DatasetMetadata | undefined> {
    const row = await this.db<DatasetMetadataRow>('data_exp_metadata')
      .where({ entity_ref: entityRef })
      .first();
    if (!row) {
      return undefined;
    }
    return this.rowToMetadata(row);
  }

  async setMetadata(metadata: DatasetMetadata): Promise<void> {
    const now = new Date().toISOString();
    const record = {
      entity_ref: metadata.entityRef,
      columns: JSON.stringify(metadata.columns ?? []),
      row_count: metadata.rowCount ?? null,
      size_bytes: metadata.sizeBytes ?? null,
      last_updated: metadata.lastUpdated ?? now,
      collected_at: now,
    };
    await this.db('data_exp_metadata')
      .insert(record)
      .onConflict('entity_ref')
      .merge(record);
  }

  private rowToMetadata(row: DatasetMetadataRow): DatasetMetadata {
    const columns =
      typeof row.columns === 'string' ? JSON.parse(row.columns) : row.columns;
    return {
      entityRef: row.entity_ref,
      columns,
      rowCount:
        row.row_count === null || row.row_count === undefined
          ? undefined
          : Number(row.row_count),
      sizeBytes:
        row.size_bytes === null || row.size_bytes === undefined
          ? undefined
          : Number(row.size_bytes),
      lastUpdated: row.last_updated
        ? new Date(row.last_updated).toISOString()
        : undefined,
    };
  }
}
