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

import { resolvePackagePath } from '@backstage/backend-plugin-api';
import { NotFoundError } from '@backstage/errors';
import { Knex } from 'knex';
import {
  SoundcheckFact,
  SoundcheckCheck,
  SoundcheckCheckResult,
  SoundcheckCheckStatus,
  SoundcheckTrack,
  SoundcheckCampaign,
  SoundcheckCertification,
  SoundcheckExemption,
} from '@backstage/plugin-soundcheck-common';
import { DateTime } from 'luxon';
import { v4 as uuid } from 'uuid';
import { applyMigrations } from './migrations';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-soundcheck-backend',
  'migrations',
);

function parseJson<T>(value: unknown): T {
  return typeof value === 'string' ? JSON.parse(value) : (value as T);
}

function toExemption(row: {
  id: string;
  check_id: string;
  entity_ref: string;
  reason: string;
  granted_by: string;
  granted_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  status: 'active' | 'revoked';
}): SoundcheckExemption {
  return {
    id: row.id,
    checkId: row.check_id,
    entityRef: row.entity_ref,
    reason: row.reason,
    grantedBy: row.granted_by,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at ?? undefined,
    revokedBy: row.revoked_by ?? undefined,
    status: row.status,
  };
}

/**
 * Database storage for Soundcheck facts, checks, tracks, campaigns,
 * check results, and certifications.
 *
 * @internal
 */
export class SoundcheckStore {
  private constructor(private readonly db: Knex) {}

  static async create(options: { database: Knex }): Promise<SoundcheckStore> {
    await applyMigrations(options.database);
    await options.database.migrate.latest({ directory: migrationsDir, tableName: 'knex_migrations_soundcheck' });
    return new SoundcheckStore(options.database);
  }

  async upsertFact(fact: SoundcheckFact): Promise<void> {
    await this.db('soundcheck_facts')
      .insert({
        fact_ref: fact.factRef,
        entity_ref: fact.entityRef,
        data: JSON.stringify(fact.data),
        collected_at: fact.collectedAt,
        expires_at: fact.expiresAt ?? null,
      })
      .onConflict(['fact_ref', 'entity_ref'])
      .merge();
  }

  async getFacts(entityRef: string): Promise<SoundcheckFact[]> {
    const rows = await this.db('soundcheck_facts').where({
      entity_ref: entityRef,
    });
    return rows.map(row => ({
      factRef: row.fact_ref,
      entityRef: row.entity_ref,
      data: parseJson<Record<string, unknown>>(row.data),
      collectedAt: row.collected_at,
      expiresAt: row.expires_at ?? undefined,
    }));
  }

  async upsertCheck(check: SoundcheckCheck): Promise<void> {
    await this.db('soundcheck_checks')
      .insert({
        id: check.id,
        name: check.name,
        description: check.description,
        fact_ref: check.factRef,
        rule: JSON.stringify(check.rule),
        owner_entity_ref: check.ownerEntityRef ?? null,
        filter: check.filter ? JSON.stringify(check.filter) : null,
      })
      .onConflict('id')
      .merge();
  }

  async getChecks(): Promise<SoundcheckCheck[]> {
    const rows = await this.db('soundcheck_checks');
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      factRef: row.fact_ref,
      rule: parseJson(row.rule),
      ownerEntityRef: row.owner_entity_ref ?? undefined,
      filter: row.filter ? parseJson(row.filter) : undefined,
    }));
  }

  async getCheck(id: string): Promise<SoundcheckCheck | undefined> {
    const row = await this.db('soundcheck_checks').where({ id }).first();
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      factRef: row.fact_ref,
      rule: parseJson(row.rule),
      ownerEntityRef: row.owner_entity_ref ?? undefined,
      filter: row.filter ? parseJson(row.filter) : undefined,
    };
  }

  /**
   * Lists the latest check results recorded for a given check across all
   * entities, optionally filtered by status and capped at `limit` rows
   * (most recently evaluated first). Used to power CSV entity exports.
   */
  async getResultsForCheck(
    checkId: string,
    filter?: { status?: SoundcheckCheckStatus; limit?: number },
  ): Promise<SoundcheckCheckResult[]> {
    let query = this.db('soundcheck_check_results').where({
      check_id: checkId,
    });
    if (filter?.status) {
      query = query.andWhere({ status: filter.status });
    }
    query = query.orderBy('evaluated_at', 'desc');
    if (filter?.limit) {
      query = query.limit(filter.limit);
    }
    const rows = await query;
    return rows.map(row => ({
      checkId: row.check_id,
      entityRef: row.entity_ref,
      status: row.status,
      message: row.message ?? undefined,
      evaluatedAt: row.evaluated_at,
    }));
  }

  async upsertCheckResult(result: SoundcheckCheckResult): Promise<void> {
    await this.db('soundcheck_check_results')
      .insert({
        check_id: result.checkId,
        entity_ref: result.entityRef,
        status: result.status,
        message: result.message ?? null,
        evaluated_at: result.evaluatedAt,
      })
      .onConflict(['check_id', 'entity_ref'])
      .merge();
  }

  async getCheckResults(entityRef: string): Promise<SoundcheckCheckResult[]> {
    const rows = await this.db('soundcheck_check_results').where({
      entity_ref: entityRef,
    });
    return rows.map(row => ({
      checkId: row.check_id,
      entityRef: row.entity_ref,
      status: row.status,
      message: row.message ?? undefined,
      evaluatedAt: row.evaluated_at,
    }));
  }

  /**
   * Lists the latest results for a single check, optionally restricted to
   * an `evaluatedAt` date range, ordered oldest first.
   */
  async getCheckResultsForCheck(
    checkId: string,
    range?: { from?: string; to?: string },
  ): Promise<SoundcheckCheckResult[]> {
    return this.queryCheckResults({ checkIds: [checkId], range });
  }

  /**
   * Lists the latest results across several checks, optionally restricted
   * to an `evaluatedAt` date range, ordered oldest first. Used to compute
   * campaign-level aggregates across every check in a track.
   */
  async getCheckResultsForChecks(
    checkIds: string[],
    range?: { from?: string; to?: string },
  ): Promise<SoundcheckCheckResult[]> {
    if (checkIds.length === 0) {
      return [];
    }
    return this.queryCheckResults({ checkIds, range });
  }

  private async queryCheckResults(options: {
    checkIds: string[];
    range?: { from?: string; to?: string };
  }): Promise<SoundcheckCheckResult[]> {
    let query = this.db('soundcheck_check_results').whereIn(
      'check_id',
      options.checkIds,
    );
    if (options.range?.from) {
      query = query.where('evaluated_at', '>=', options.range.from);
    }
    if (options.range?.to) {
      query = query.where('evaluated_at', '<=', options.range.to);
    }
    const rows = await query.orderBy('evaluated_at', 'asc');
    return rows.map(row => ({
      checkId: row.check_id,
      entityRef: row.entity_ref,
      status: row.status,
      message: row.message ?? undefined,
      evaluatedAt: row.evaluated_at,
    }));
  }

  async upsertTrack(track: SoundcheckTrack): Promise<void> {
    await this.db('soundcheck_tracks')
      .insert({
        id: track.id,
        name: track.name,
        description: track.description,
        owner_entity_ref: track.ownerEntityRef ?? null,
        levels: JSON.stringify(track.levels),
        filter: track.filter ? JSON.stringify(track.filter) : null,
      })
      .onConflict('id')
      .merge();
  }

  async getTracks(): Promise<SoundcheckTrack[]> {
    const rows = await this.db('soundcheck_tracks');
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      ownerEntityRef: row.owner_entity_ref ?? undefined,
      levels: parseJson(row.levels),
      filter: row.filter ? parseJson(row.filter) : undefined,
    }));
  }

  async getTrack(id: string): Promise<SoundcheckTrack | undefined> {
    const row = await this.db('soundcheck_tracks').where({ id }).first();
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      ownerEntityRef: row.owner_entity_ref ?? undefined,
      levels: parseJson(row.levels),
      filter: row.filter ? parseJson(row.filter) : undefined,
    };
  }

  async upsertCampaign(campaign: SoundcheckCampaign): Promise<void> {
    await this.db('soundcheck_campaigns')
      .insert({
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        track_id: campaign.trackId,
        target_level: campaign.targetLevel,
        start_date: campaign.startDate,
        end_date: campaign.endDate,
        target_filter: campaign.targetFilter
          ? JSON.stringify(campaign.targetFilter)
          : null,
        owner_entity_ref: campaign.ownerEntityRef ?? null,
      })
      .onConflict('id')
      .merge();
  }

  async getCampaigns(): Promise<SoundcheckCampaign[]> {
    const rows = await this.db('soundcheck_campaigns');
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      trackId: row.track_id,
      targetLevel: row.target_level,
      startDate: row.start_date,
      endDate: row.end_date,
      targetFilter: row.target_filter
        ? parseJson(row.target_filter)
        : undefined,
      ownerEntityRef: row.owner_entity_ref ?? undefined,
    }));
  }

  async getCampaign(id: string): Promise<SoundcheckCampaign | undefined> {
    const row = await this.db('soundcheck_campaigns').where({ id }).first();
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      trackId: row.track_id,
      targetLevel: row.target_level,
      startDate: row.start_date,
      endDate: row.end_date,
      targetFilter: row.target_filter
        ? parseJson(row.target_filter)
        : undefined,
      ownerEntityRef: row.owner_entity_ref ?? undefined,
    };
  }

  async upsertCertification(cert: SoundcheckCertification): Promise<void> {
    await this.db('soundcheck_certifications')
      .insert({
        entity_ref: cert.entityRef,
        track_id: cert.trackId,
        level_name: cert.levelName,
        level_rank: cert.levelRank,
        certified_at: cert.certifiedAt,
      })
      .onConflict(['entity_ref', 'track_id'])
      .merge();
  }

  async getCertifications(
    entityRef: string,
  ): Promise<SoundcheckCertification[]> {
    const rows = await this.db('soundcheck_certifications').where({
      entity_ref: entityRef,
    });
    return rows.map(row => ({
      entityRef: row.entity_ref,
      trackId: row.track_id,
      levelName: row.level_name,
      levelRank: row.level_rank,
      certifiedAt: row.certified_at,
    }));
  }

  /**
   * Lists every certification granted for a track, ordered oldest first,
   * used to compute per-level distributions and adoption trends.
   */
  async getCertificationsForTrack(
    trackId: string,
  ): Promise<SoundcheckCertification[]> {
    const rows = await this.db('soundcheck_certifications')
      .where({ track_id: trackId })
      .orderBy('certified_at', 'asc');
    return rows.map(row => ({
      entityRef: row.entity_ref,
      trackId: row.track_id,
      levelName: row.level_name,
      levelRank: row.level_rank,
      certifiedAt: row.certified_at,
    }));
  }

  async createExemption(input: {
    checkId: string;
    entityRef: string;
    reason: string;
    grantedBy: string;
  }): Promise<SoundcheckExemption> {
    const id = uuid();
    const grantedAt = DateTime.now().toISO() as string;
    await this.db('soundcheck_exemptions').insert({
      id,
      check_id: input.checkId,
      entity_ref: input.entityRef,
      reason: input.reason,
      granted_by: input.grantedBy,
      granted_at: grantedAt,
      status: 'active',
    });
    return {
      id,
      checkId: input.checkId,
      entityRef: input.entityRef,
      reason: input.reason,
      grantedBy: input.grantedBy,
      grantedAt,
      status: 'active',
    };
  }

  async revokeExemption(id: string, revokedBy: string): Promise<void> {
    const revokedAt = DateTime.now().toISO() as string;
    const updated = await this.db('soundcheck_exemptions')
      .where({ id })
      .update({
        status: 'revoked',
        revoked_by: revokedBy,
        revoked_at: revokedAt,
      });
    if (!updated) {
      throw new NotFoundError(`Soundcheck exemption ${id} not found`);
    }
  }

  async restoreExemption(id: string): Promise<void> {
    const updated = await this.db('soundcheck_exemptions')
      .where({ id })
      .update({
        status: 'active',
        revoked_by: null,
        revoked_at: null,
      });
    if (!updated) {
      throw new NotFoundError(`Soundcheck exemption ${id} not found`);
    }
  }

  async listExemptions(filter?: {
    checkId?: string;
    entityRef?: string;
  }): Promise<SoundcheckExemption[]> {
    let query = this.db('soundcheck_exemptions');
    if (filter?.checkId) {
      query = query.where({ check_id: filter.checkId });
    }
    if (filter?.entityRef) {
      query = query.where({ entity_ref: filter.entityRef });
    }
    const rows = await query.orderBy('granted_at', 'desc');
    return rows.map(toExemption);
  }

  async isExempt(checkId: string, entityRef: string): Promise<boolean> {
    const row = await this.db('soundcheck_exemptions')
      .where({ check_id: checkId, entity_ref: entityRef, status: 'active' })
      .first();
    return Boolean(row);
  }

  /**
   * Deletes check results older than `retentionTimeInDays`, returning the
   * number of deleted rows. Used by the scheduled history cleanup task.
   */
  async deleteExpiredCheckResults(
    retentionTimeInDays: number,
  ): Promise<number> {
    const cutoff = DateTime.now()
      .minus({ days: retentionTimeInDays })
      .toISO() as string;
    return this.db('soundcheck_check_results')
      .where('evaluated_at', '<', cutoff)
      .del();
  }
}
