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
import { AggregationBucket, EventFilter, InsightsEvent } from '../types';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-insights-backend',
  'migrations',
);

function truncateToPeriod(date: Date, period: 'hour' | 'day'): Date {
  const truncated = new Date(date);
  truncated.setUTCMinutes(0, 0, 0);
  if (period === 'day') {
    truncated.setUTCHours(0);
  }
  return truncated;
}

/** @internal */
export class InsightsStore {
  private constructor(private readonly db: Knex) {}

  static async create(options: { database: Knex }): Promise<InsightsStore> {
    await options.database.migrate.latest({
      directory: migrationsDir,
    tableName: 'knex_migrations_insights',
    });
    return new InsightsStore(options.database);
  }

  async recordEvent(event: InsightsEvent): Promise<void> {
    await this.db('insights_events').insert({
      event_type: event.eventType,
      user_ref: event.userRef,
      target: event.target,
      metadata: JSON.stringify(event.metadata ?? {}),
    });
  }

  async queryEvents(filter: EventFilter): Promise<InsightsEvent[]> {
    let q = this.db('insights_events').select('*');
    if (filter.eventType) q = q.where('event_type', filter.eventType);
    if (filter.userRef) q = q.where('user_ref', filter.userRef);
    if (filter.target) q = q.where('target', filter.target);
    if (filter.from) q = q.where('timestamp', '>=', filter.from);
    if (filter.to) q = q.where('timestamp', '<=', filter.to);
    q = q.orderBy('timestamp', 'desc').limit(filter.limit ?? 100);
    const rows = await q;
    return rows.map(row => this.rowToEvent(row));
  }

  async getAggregations(
    key: string,
    period: string,
    from: string,
    to: string,
  ): Promise<AggregationBucket[]> {
    const rows = await this.db('insights_aggregations')
      .where('key', key)
      .where('period', period)
      .whereBetween('period_start', [from, to])
      .orderBy('period_start', 'asc');
    return rows.map(row => ({
      key: row.key,
      period: row.period,
      count: row.count,
      periodStart: row.period_start,
    }));
  }

  /**
   * Aggregates all events recorded within the current bucket for the given
   * period, upserting one row per distinct event type.
   */
  async aggregate(period: 'hour' | 'day'): Promise<void> {
    const now = new Date();
    const bucketStart = truncateToPeriod(now, period);
    const bucketEnd = new Date(now);

    const rows = await this.db('insights_events')
      .select('event_type')
      .count<Array<{ event_type: string; count: string | number }>>(
        'id as count',
      )
      .where('timestamp', '>=', bucketStart.toISOString())
      .where('timestamp', '<=', bucketEnd.toISOString())
      .groupBy('event_type');

    for (const row of rows) {
      await this.db('insights_aggregations')
        .insert({
          key: row.event_type,
          period,
          count: Number(row.count),
          period_start: bucketStart.toISOString(),
        })
        .onConflict(['key', 'period', 'period_start'])
        .merge({ count: Number(row.count) });
    }
  }

  async getTopFeatures(options: {
    from: string;
    to: string;
    limit?: number;
  }): Promise<Array<{ target: string; count: number }>> {
    const rows = await this.db('insights_events')
      .select('target')
      .count<Array<{ target: string; count: string | number }>>('id as count')
      .where('event_type', 'feature_used')
      .whereNotNull('target')
      .where('timestamp', '>=', options.from)
      .where('timestamp', '<=', options.to)
      .groupBy('target')
      .orderBy('count', 'desc')
      .limit(options.limit ?? 10);
    return rows.map(row => ({ target: row.target, count: Number(row.count) }));
  }

  async getSearchAnalytics(options: { from: string; to: string }): Promise<{
    topQueries: Array<{ query: string; count: number }>;
    zeroResultQueries: Array<{ query: string; count: number }>;
  }> {
    const rows = await this.db('insights_events')
      .select('metadata')
      .where('event_type', 'search')
      .where('timestamp', '>=', options.from)
      .where('timestamp', '<=', options.to);

    const queryCounts = new Map<string, number>();
    const zeroResultCounts = new Map<string, number>();
    for (const row of rows) {
      const metadata = JSON.parse(row.metadata ?? '{}') as {
        query?: string;
        resultCount?: number;
      };
      if (!metadata.query) continue;
      queryCounts.set(
        metadata.query,
        (queryCounts.get(metadata.query) ?? 0) + 1,
      );
      if (metadata.resultCount === 0) {
        zeroResultCounts.set(
          metadata.query,
          (zeroResultCounts.get(metadata.query) ?? 0) + 1,
        );
      }
    }

    const toSorted = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count);

    return {
      topQueries: toSorted(queryCounts),
      zeroResultQueries: toSorted(zeroResultCounts),
    };
  }

  private rowToEvent(row: {
    id: number;
    event_type: string;
    user_ref: string;
    target?: string;
    metadata: string;
    timestamp: string;
  }): InsightsEvent {
    return {
      id: row.id,
      eventType: row.event_type,
      userRef: row.user_ref,
      target: row.target ?? undefined,
      metadata: JSON.parse(row.metadata ?? '{}'),
      timestamp: row.timestamp,
    };
  }
}
