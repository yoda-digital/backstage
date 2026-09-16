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
import { AiRule, AiRuleQuery } from '@backstage/plugin-ai-explorer-common';

interface RuleRow {
  id: string;
  name: string;
  description: string;
  type: AiRule['type'];
  config: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Stores AI guardrail rules.
 *
 * @internal
 */
export class RuleStore {
  constructor(private readonly db: Knex) {}

  async create(
    rule: Omit<AiRule, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AiRule> {
    const id = uuid();
    const now = new Date().toISOString();
    await this.db('ai_explorer_rules').insert({
      id,
      name: rule.name,
      description: rule.description,
      type: rule.type,
      config: JSON.stringify(rule.config),
      enabled: rule.enabled,
      created_at: now,
      updated_at: now,
    });
    return { ...rule, id, createdAt: now, updatedAt: now };
  }

  async get(id: string): Promise<AiRule | undefined> {
    const row = await this.db<RuleRow>('ai_explorer_rules')
      .where({ id })
      .first();
    return row ? this.rowToRule(row) : undefined;
  }

  async list(query: AiRuleQuery): Promise<AiRule[]> {
    let qb = this.db<RuleRow>('ai_explorer_rules').select('*');
    if (query.type) qb = qb.where('type', query.type);
    if (query.enabled !== undefined) qb = qb.where('enabled', query.enabled);
    qb = qb.orderBy('created_at', 'desc');
    if (query.limit) qb = qb.limit(query.limit);
    if (query.offset) qb = qb.offset(query.offset);
    const rows = await qb;
    return rows.map(r => this.rowToRule(r));
  }

  async update(
    id: string,
    updates: Partial<Omit<AiRule, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<void> {
    const data: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined)
      data.description = updates.description;
    if (updates.type !== undefined) data.type = updates.type;
    if (updates.config !== undefined)
      data.config = JSON.stringify(updates.config);
    if (updates.enabled !== undefined) data.enabled = updates.enabled;
    await this.db('ai_explorer_rules').where({ id }).update(data);
  }

  async delete(id: string): Promise<void> {
    await this.db('ai_explorer_rules').where({ id }).delete();
  }

  private rowToRule(row: RuleRow): AiRule {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      config: JSON.parse(row.config),
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
