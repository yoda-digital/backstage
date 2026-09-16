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
  AuditEvent,
  AuditQuery,
  AuditQueryResult,
} from '@backstage/plugin-audit-log-common';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-audit-log-backend',
  'migrations',
);

/** @internal */
export class AuditStore {
  private constructor(private readonly db: Knex) {}

  static async create(options: { database: Knex }): Promise<AuditStore> {
    await options.database.migrate.latest({
      directory: migrationsDir,
    });
    return new AuditStore(options.database);
  }

  async recordEvent(event: AuditEvent): Promise<void> {
    await this.db('audit_events').insert({
      id: event.id,
      action: event.action,
      actor: event.actor,
      entity_ref: event.entityRef ?? null,
      metadata: JSON.stringify(event.metadata ?? {}),
      timestamp: event.timestamp,
      status: event.status,
      severity: event.severity,
      plugin_id: event.pluginId,
      request_details: event.requestDetails
        ? JSON.stringify(event.requestDetails)
        : null,
    });
  }

  async queryEvents(query: AuditQuery): Promise<AuditQueryResult> {
    let builder = this.db('audit_events');

    if (query.actor) {
      builder = builder.where('actor', query.actor);
    }
    if (query.entityRef) {
      builder = builder.where('entity_ref', query.entityRef);
    }
    if (query.action) {
      builder = builder.where('action', query.action);
    }
    if (query.severity) {
      builder = builder.where('severity', query.severity);
    }
    if (query.pluginId) {
      builder = builder.where('plugin_id', query.pluginId);
    }
    if (query.from) {
      builder = builder.where('timestamp', '>=', query.from);
    }
    if (query.to) {
      builder = builder.where('timestamp', '<=', query.to);
    }

    const countResult = await builder.clone().count({ total: '*' }).first();
    const totalCount = Number(countResult?.total ?? 0);

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const rows = await builder
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .offset(offset)
      .select('*');

    const events: AuditEvent[] = rows.map(row => {
      let requestDetails;
      if (row.request_details) {
        requestDetails =
          typeof row.request_details === 'string'
            ? JSON.parse(row.request_details)
            : row.request_details;
      }
      return {
        id: row.id,
        action: row.action,
        actor: row.actor,
        entityRef: row.entity_ref ?? undefined,
        metadata:
          typeof row.metadata === 'string'
            ? JSON.parse(row.metadata)
            : row.metadata,
        timestamp:
          row.timestamp instanceof Date
            ? row.timestamp.toISOString()
            : String(row.timestamp),
        status: row.status as 'succeeded' | 'failed',
        severity: row.severity as AuditEvent['severity'],
        pluginId: row.plugin_id,
        requestDetails,
      };
    });

    return { events, totalCount };
  }
}
