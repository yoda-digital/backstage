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
  CreateGigRequest,
  Gig,
  GigApplication,
  GigMatch,
  GigStatus,
  GigType,
  SkillProfile,
} from '@backstage/plugin-skill-exchange-common';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-skill-exchange-backend',
  'migrations',
);

/** @internal */
export interface GigFilter {
  type?: GigType;
  direction?: 'offer' | 'request';
  status?: GigStatus;
  skills?: string[];
}

interface GigRow {
  id: string;
  type: GigType;
  title: string;
  description: string;
  skills: string | string[];
  direction: 'offer' | 'request';
  created_by: string;
  status: GigStatus;
  matched_with: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | Date;
}

interface SkillProfileRow {
  user_ref: string;
  skills: string | SkillProfile['skills'];
  interests: string | string[];
  availability: SkillProfile['availability'];
}

interface GigApplicationRow {
  id: string;
  gig_id: string;
  applicant_ref: string;
  message: string | null;
  status: GigApplication['status'];
  created_at: string | Date;
}

interface GigMatchRow {
  offer_id: string;
  request_id: string;
  score: number;
  matched_skills: string | string[];
  matched_at: string | Date;
}

/** @internal */
export class GigStore {
  private constructor(private readonly db: Knex) {}

  static async create(options: { database: Knex }): Promise<GigStore> {
    await options.database.migrate.latest({
      directory: migrationsDir,
    tableName: 'knex_migrations_skill_exchange',
    });
    return new GigStore(options.database);
  }

  async createGig(request: CreateGigRequest, createdBy: string): Promise<Gig> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const status: GigStatus = 'open';

    await this.db('skill_gigs').insert({
      id,
      type: request.type,
      title: request.title,
      description: request.description ?? '',
      skills: JSON.stringify(request.skills),
      direction: request.direction,
      created_by: createdBy,
      status,
      matched_with: null,
      start_date: request.startDate ?? null,
      end_date: request.endDate ?? null,
      created_at: createdAt,
    });

    return {
      id,
      type: request.type,
      title: request.title,
      description: request.description ?? '',
      skills: request.skills,
      direction: request.direction,
      createdBy,
      status,
      startDate: request.startDate,
      endDate: request.endDate,
      createdAt,
    };
  }

  async listGigs(filter: GigFilter = {}): Promise<Gig[]> {
    let query = this.db<GigRow>('skill_gigs').select('*');
    if (filter.type) {
      query = query.where('type', filter.type);
    }
    if (filter.direction) {
      query = query.where('direction', filter.direction);
    }
    if (filter.status) {
      query = query.where('status', filter.status);
    }

    const rows = await query.orderBy('created_at', 'desc');
    let gigs = rows.map(row => this.rowToGig(row));

    if (filter.skills && filter.skills.length > 0) {
      const wanted = new Set(filter.skills.map(s => s.toLowerCase()));
      gigs = gigs.filter(gig =>
        gig.skills.some(skill => wanted.has(skill.toLowerCase())),
      );
    }

    return gigs;
  }

  async getGig(id: string): Promise<Gig | undefined> {
    const row = await this.db<GigRow>('skill_gigs').where({ id }).first();
    return row ? this.rowToGig(row) : undefined;
  }

  async updateGigStatus(
    id: string,
    status: GigStatus,
    matchedWith?: string,
  ): Promise<Gig | undefined> {
    const update: Partial<GigRow> = { status };
    if (matchedWith !== undefined) {
      update.matched_with = matchedWith;
    }
    await this.db('skill_gigs').where({ id }).update(update);
    return this.getGig(id);
  }

  async getProfile(userRef: string): Promise<SkillProfile | undefined> {
    const row = await this.db<SkillProfileRow>('skill_profiles')
      .where({ user_ref: userRef })
      .first();
    return row ? this.rowToProfile(row) : undefined;
  }

  async listProfiles(): Promise<SkillProfile[]> {
    const rows = await this.db<SkillProfileRow>('skill_profiles').select('*');
    return rows.map(row => this.rowToProfile(row));
  }

  /**
   * Returns the distinct set of skill names currently used across gigs and
   * skill profiles, for merging with any YAML-configured canonical skills.
   */
  async listDistinctSkills(): Promise<string[]> {
    const [gigRows, profileRows] = await Promise.all([
      this.db<GigRow>('skill_gigs').select('skills'),
      this.db<SkillProfileRow>('skill_profiles').select('skills'),
    ]);
    const skills = new Set<string>();
    for (const row of gigRows) {
      const rowSkills =
        typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills;
      for (const skill of rowSkills) {
        skills.add(skill);
      }
    }
    for (const row of profileRows) {
      const rowSkills =
        typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills;
      for (const skill of rowSkills) {
        skills.add(skill.name);
      }
    }
    return Array.from(skills).sort();
  }

  async setProfile(profile: SkillProfile): Promise<void> {
    const record = {
      user_ref: profile.userRef,
      skills: JSON.stringify(profile.skills),
      interests: JSON.stringify(profile.interests),
      availability: profile.availability,
      updated_at: new Date().toISOString(),
    };
    await this.db('skill_profiles')
      .insert(record)
      .onConflict('user_ref')
      .merge(record);
  }

  async saveMatches(matches: GigMatch[]): Promise<void> {
    if (matches.length === 0) {
      return;
    }
    await this.db('skill_matches').insert(
      matches.map(match => ({
        offer_id: match.offerId,
        request_id: match.requestId,
        score: match.score,
        matched_skills: JSON.stringify(match.matchedSkills),
        matched_at: match.matchedAt,
      })),
    );
  }

  async getMatchesForGig(gigId: string): Promise<GigMatch[]> {
    const rows = await this.db<GigMatchRow>('skill_matches')
      .where({ offer_id: gigId })
      .orWhere({ request_id: gigId })
      .orderBy('score', 'desc');
    return rows.map(row => this.rowToMatch(row));
  }

  async listAllMatches(): Promise<GigMatch[]> {
    const rows = await this.db<GigMatchRow>('skill_matches').orderBy(
      'score',
      'desc',
    );
    return rows.map(row => this.rowToMatch(row));
  }

  async createApplication(
    gigId: string,
    applicantRef: string,
    message: string | undefined,
  ): Promise<GigApplication> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await this.db('skill_applications').insert({
      id,
      gig_id: gigId,
      applicant_ref: applicantRef,
      message: message ?? null,
      status: 'pending',
      created_at: createdAt,
    });
    return {
      id,
      gigId,
      applicantRef,
      message,
      status: 'pending',
      createdAt,
    };
  }

  async listApplications(filter: {
    gigId?: string;
    applicantRef?: string;
  }): Promise<GigApplication[]> {
    let query = this.db<GigApplicationRow>('skill_applications').select('*');
    if (filter.gigId) {
      query = query.where('gig_id', filter.gigId);
    }
    if (filter.applicantRef) {
      query = query.where('applicant_ref', filter.applicantRef);
    }
    const rows = await query.orderBy('created_at', 'desc');
    return rows.map(row => this.rowToApplication(row));
  }

  async getApplication(id: string): Promise<GigApplication | undefined> {
    const row = await this.db<GigApplicationRow>('skill_applications')
      .where({ id })
      .first();
    return row ? this.rowToApplication(row) : undefined;
  }

  async updateApplicationStatus(
    id: string,
    status: GigApplication['status'],
  ): Promise<GigApplication> {
    const updated = await this.db('skill_applications')
      .where({ id })
      .update({ status });
    if (updated === 0) {
      throw new NotFoundError(`No application found with id ${id}`);
    }
    return (await this.getApplication(id))!;
  }

  private rowToApplication(row: GigApplicationRow): GigApplication {
    return {
      id: row.id,
      gigId: row.gig_id,
      applicantRef: row.applicant_ref,
      message: row.message ?? undefined,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  private rowToGig(row: GigRow): Gig {
    const skills =
      typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills;
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      skills,
      direction: row.direction,
      createdBy: row.created_by,
      status: row.status,
      matchedWith: row.matched_with ?? undefined,
      startDate: row.start_date ?? undefined,
      endDate: row.end_date ?? undefined,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  private rowToProfile(row: SkillProfileRow): SkillProfile {
    const skills =
      typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills;
    const interests =
      typeof row.interests === 'string'
        ? JSON.parse(row.interests)
        : row.interests;
    return {
      userRef: row.user_ref,
      skills,
      interests,
      availability: row.availability,
    };
  }

  private rowToMatch(row: GigMatchRow): GigMatch {
    const matchedSkills =
      typeof row.matched_skills === 'string'
        ? JSON.parse(row.matched_skills)
        : row.matched_skills;
    return {
      offerId: row.offer_id,
      requestId: row.request_id,
      score: row.score,
      matchedSkills,
      matchedAt: new Date(row.matched_at).toISOString(),
    };
  }
}
