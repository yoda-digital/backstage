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
  EntityOverlay,
  OverlayPatch,
} from '@backstage/plugin-entity-overlays-common';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-entity-overlays-backend',
  'migrations',
);

/** @internal */
export class OverlayStore {
  private constructor(private readonly db: Knex) {}

  static async create(options: { database: Knex }): Promise<OverlayStore> {
    await options.database.migrate.latest({
      directory: migrationsDir,
    });
    return new OverlayStore(options.database);
  }

  async getOverlay(entityRef: string): Promise<EntityOverlay | undefined> {
    const row = await this.db('entity_overlays')
      .where({ entity_ref: entityRef })
      .first();
    if (!row) {
      return undefined;
    }
    return this.rowToOverlay(row);
  }

  async listOverlays(): Promise<EntityOverlay[]> {
    const rows = await this.db('entity_overlays')
      .select('*')
      .orderBy('updated_at', 'desc');
    return rows.map(row => this.rowToOverlay(row));
  }

  async setOverlay(
    entityRef: string,
    patches: OverlayPatch[],
    updatedBy: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db('entity_overlays')
      .insert({
        entity_ref: entityRef,
        patches: JSON.stringify(patches),
        updated_by: updatedBy,
        updated_at: now,
      })
      .onConflict('entity_ref')
      .merge({
        patches: JSON.stringify(patches),
        updated_by: updatedBy,
        updated_at: now,
      });
  }

  async deleteOverlay(entityRef: string): Promise<void> {
    await this.db('entity_overlays').where({ entity_ref: entityRef }).delete();
  }

  private rowToOverlay(row: {
    entity_ref: string;
    patches: string;
    updated_by: string;
    updated_at: string;
  }): EntityOverlay {
    return {
      entityRef: row.entity_ref,
      patches: JSON.parse(row.patches),
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
    };
  }
}
