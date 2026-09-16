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
import { v4 as uuid } from 'uuid';
import { AiSkill, AiSkillQuery } from '@backstage/plugin-ai-explorer-common';

interface SkillRow {
  id: string;
  name: string;
  description: string;
  prompt_template: string;
  variables: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

/**
 * Stores reusable AI prompt skills/templates.
 *
 * @internal
 */
export class SkillStore {
  constructor(private readonly db: Knex) {}

  async create(
    skill: Omit<AiSkill, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AiSkill> {
    const id = uuid();
    const now = new Date().toISOString();
    await this.db('ai_explorer_skills').insert({
      id,
      name: skill.name,
      description: skill.description,
      prompt_template: skill.promptTemplate,
      variables: JSON.stringify(skill.variables),
      tags: JSON.stringify(skill.tags),
      created_at: now,
      updated_at: now,
    });
    return { ...skill, id, createdAt: now, updatedAt: now };
  }

  async get(id: string): Promise<AiSkill | undefined> {
    const row = await this.db<SkillRow>('ai_explorer_skills')
      .where({ id })
      .first();
    return row ? this.rowToSkill(row) : undefined;
  }

  async list(query: AiSkillQuery): Promise<AiSkill[]> {
    let qb = this.db<SkillRow>('ai_explorer_skills').select('*');
    if (query.search) qb = qb.where('name', 'like', `%${query.search}%`);
    qb = qb.orderBy('created_at', 'desc');
    if (query.limit) qb = qb.limit(query.limit);
    if (query.offset) qb = qb.offset(query.offset);
    const rows = await qb;
    let skills = rows.map(r => this.rowToSkill(r));
    if (query.tags && query.tags.length > 0) {
      skills = skills.filter(s => query.tags!.some(t => s.tags.includes(t)));
    }
    return skills;
  }

  async update(
    id: string,
    updates: Partial<Omit<AiSkill, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<void> {
    const data: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined)
      data.description = updates.description;
    if (updates.promptTemplate !== undefined)
      data.prompt_template = updates.promptTemplate;
    if (updates.variables !== undefined)
      data.variables = JSON.stringify(updates.variables);
    if (updates.tags !== undefined) data.tags = JSON.stringify(updates.tags);
    await this.db('ai_explorer_skills').where({ id }).update(data);
  }

  async delete(id: string): Promise<void> {
    await this.db('ai_explorer_skills').where({ id }).delete();
  }

  private rowToSkill(row: SkillRow): AiSkill {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      promptTemplate: row.prompt_template,
      variables: JSON.parse(row.variables),
      tags: JSON.parse(row.tags),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
