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
import { AiPlugin } from '@backstage/plugin-ai-explorer-common';

interface PluginRow {
  id: string;
  name: string;
  description: string;
  server_url: string;
  transport: AiPlugin['transport'];
  tools: string;
  enabled: boolean;
  created_at: string;
}

/**
 * Stores registered MCP plugin/server marketplace entries.
 *
 * @internal
 */
export class PluginStore {
  constructor(private readonly db: Knex) {}

  async create(plugin: Omit<AiPlugin, 'id' | 'createdAt'>): Promise<AiPlugin> {
    const id = uuid();
    const now = new Date().toISOString();
    await this.db('ai_explorer_plugins').insert({
      id,
      name: plugin.name,
      description: plugin.description,
      server_url: plugin.serverUrl,
      transport: plugin.transport,
      tools: JSON.stringify(plugin.tools),
      enabled: plugin.enabled,
      created_at: now,
    });
    return { ...plugin, id, createdAt: now };
  }

  async get(id: string): Promise<AiPlugin | undefined> {
    const row = await this.db<PluginRow>('ai_explorer_plugins')
      .where({ id })
      .first();
    return row ? this.rowToPlugin(row) : undefined;
  }

  async list(): Promise<AiPlugin[]> {
    const rows = await this.db<PluginRow>('ai_explorer_plugins')
      .select('*')
      .orderBy('created_at', 'desc');
    return rows.map(r => this.rowToPlugin(r));
  }

  async delete(id: string): Promise<void> {
    await this.db('ai_explorer_plugins').where({ id }).delete();
  }

  private rowToPlugin(row: PluginRow): AiPlugin {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      serverUrl: row.server_url,
      transport: row.transport,
      tools: JSON.parse(row.tools),
      enabled: row.enabled,
      createdAt: row.created_at,
    };
  }
}
