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
import { NotAllowedError, NotFoundError } from '@backstage/errors';
import {
  AiMode,
  AiModeVisibility,
  AiProcessor,
  CreateModeRequest,
  UpdateModeRequest,
} from '@backstage/plugin-ai-assistant-common';

interface ModeRow {
  id: string;
  name: string;
  description: string;
  instructions: string;
  visibility: AiModeVisibility;
  owner_ref: string;
  processors: string | AiProcessor[];
  mcp_tools: string | string[] | null;
  model_override: string | null;
  max_steps: number | null;
  temperature: number | null;
  usage_count_30d: number;
  created_at: string;
  updated_at: string;
}

const TABLE = 'ai_modes';

/**
 * Stores user-defined AiKA modes: their instructions, tool access, and
 * processor pipeline configuration. Handles CRUD, visibility (a mode is
 * visible to its owner, and to everyone once made public), and the "most
 * popular" analytics query used by the mode selector.
 *
 * @internal
 */
export class ModeStore {
  private constructor(private readonly db: Knex) {}

  static create(db: Knex): ModeStore {
    return new ModeStore(db);
  }

  async create(ownerRef: string, request: CreateModeRequest): Promise<AiMode> {
    const id = uuid();
    const now = new Date().toISOString();
    const row = {
      id,
      name: request.name,
      description: request.description,
      instructions: request.instructions,
      visibility: request.visibility,
      owner_ref: ownerRef,
      processors: JSON.stringify(request.processors ?? []),
      mcp_tools: request.mcpTools ? JSON.stringify(request.mcpTools) : null,
      model_override: request.modelOverride ?? null,
      max_steps: request.maxSteps ?? null,
      temperature: request.temperature ?? null,
      usage_count_30d: 0,
      created_at: now,
      updated_at: now,
    };
    await this.db(TABLE).insert(row);
    return this.rowToMode(row);
  }

  /** Lists modes visible to the given user: all public modes, plus their own private ones. */
  async list(userEntityRef?: string): Promise<AiMode[]> {
    let query = this.db<ModeRow>(TABLE).where('visibility', 'public');
    if (userEntityRef) {
      query = query.orWhere('owner_ref', userEntityRef);
    }
    const rows = await query.orderBy('name', 'asc');
    return rows.map(row => this.rowToMode(row));
  }

  /** Returns the top modes by usage over the last 30 days, visible to the given user. */
  async popular(userEntityRef?: string, limit = 5): Promise<AiMode[]> {
    const visible = await this.list(userEntityRef);
    return visible
      .filter(mode => mode.usageCount30d > 0)
      .sort((a, b) => b.usageCount30d - a.usageCount30d)
      .slice(0, limit);
  }

  async get(id: string, userEntityRef?: string): Promise<AiMode | undefined> {
    const row = await this.db<ModeRow>(TABLE).where({ id }).first();
    if (!row) {
      return undefined;
    }
    if (row.visibility === 'private' && row.owner_ref !== userEntityRef) {
      return undefined;
    }
    return this.rowToMode(row);
  }

  async update(
    id: string,
    ownerRef: string,
    request: UpdateModeRequest,
  ): Promise<AiMode> {
    await this.requireOwned(id, ownerRef);
    const now = new Date().toISOString();
    const patch: Partial<ModeRow> = { updated_at: now };
    if (request.name !== undefined) patch.name = request.name;
    if (request.description !== undefined)
      patch.description = request.description;
    if (request.instructions !== undefined)
      patch.instructions = request.instructions;
    if (request.visibility !== undefined) patch.visibility = request.visibility;
    if (request.processors !== undefined)
      patch.processors = JSON.stringify(request.processors);
    if (request.mcpTools !== undefined)
      patch.mcp_tools = JSON.stringify(request.mcpTools);
    if (request.modelOverride !== undefined)
      patch.model_override = request.modelOverride;
    if (request.maxSteps !== undefined) patch.max_steps = request.maxSteps;
    if (request.temperature !== undefined)
      patch.temperature = request.temperature;

    await this.db<ModeRow>(TABLE).where({ id }).update(patch);
    return (await this.get(id, ownerRef))!;
  }

  async delete(id: string, ownerRef: string): Promise<void> {
    await this.requireOwned(id, ownerRef);
    await this.db<ModeRow>(TABLE).where({ id }).delete();
  }

  /** Increments the 30-day usage counter for a mode, e.g. after it serves a message. */
  async recordUsage(id: string): Promise<void> {
    await this.db<ModeRow>(TABLE).where({ id }).increment('usage_count_30d', 1);
  }

  private async requireOwned(id: string, ownerRef: string): Promise<AiMode> {
    const row = await this.db<ModeRow>(TABLE).where({ id }).first();
    if (!row) {
      throw new NotFoundError(`Mode '${id}' not found`);
    }
    if (row.owner_ref !== ownerRef) {
      throw new NotAllowedError(`You do not own mode '${id}'`);
    }
    return this.rowToMode(row);
  }

  private rowToMode(row: ModeRow): AiMode {
    const processors =
      typeof row.processors === 'string'
        ? JSON.parse(row.processors)
        : row.processors ?? [];
    const mcpTools =
      typeof row.mcp_tools === 'string'
        ? JSON.parse(row.mcp_tools)
        : row.mcp_tools ?? undefined;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      instructions: row.instructions,
      visibility: row.visibility,
      ownerRef: row.owner_ref,
      processors,
      mcpTools,
      modelOverride: row.model_override ?? undefined,
      maxSteps: row.max_steps ?? undefined,
      temperature: row.temperature ?? undefined,
      usageCount30d: row.usage_count_30d,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
