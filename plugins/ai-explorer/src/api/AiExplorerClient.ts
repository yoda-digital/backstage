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

import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import {
  AiRule,
  AiSkill,
  AiPlugin,
  AiRuleQuery,
  AiSkillQuery,
} from '@backstage/plugin-ai-explorer-common';

/**
 * API for interacting with the ai-explorer-backend REST API.
 *
 * @public
 */
export interface AiExplorerApi {
  /** Lists guardrail rules, optionally filtered by the given query. */
  listRules(query?: AiRuleQuery): Promise<AiRule[]>;
  /** Creates a new guardrail rule. */
  createRule(
    rule: Omit<AiRule, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AiRule>;
  /** Updates an existing guardrail rule. */
  updateRule(id: string, updates: Partial<AiRule>): Promise<void>;
  /** Deletes a guardrail rule. */
  deleteRule(id: string): Promise<void>;
  /** Lists reusable prompt skills, optionally filtered by the given query. */
  listSkills(query?: AiSkillQuery): Promise<AiSkill[]>;
  /** Creates a new reusable prompt skill. */
  createSkill(
    skill: Omit<AiSkill, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AiSkill>;
  /** Updates an existing reusable prompt skill. */
  updateSkill(id: string, updates: Partial<AiSkill>): Promise<void>;
  /** Deletes a reusable prompt skill. */
  deleteSkill(id: string): Promise<void>;
  /** Lists registered MCP plugin/server registrations. */
  listPlugins(): Promise<AiPlugin[]>;
  /** Registers a new MCP plugin/server. */
  createPlugin(plugin: Omit<AiPlugin, 'id' | 'createdAt'>): Promise<AiPlugin>;
}

/**
 * {@link @backstage/core-plugin-api#ApiRef} for the {@link AiExplorerApi}.
 *
 * @public
 */
export const aiExplorerApiRef = createApiRef<AiExplorerApi>({
  id: 'plugin.ai-explorer.service',
});

/**
 * Options for creating an {@link AiExplorerClient}.
 *
 * @public
 */
export interface AiExplorerClientOptions {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
}

/**
 * Default {@link AiExplorerApi} implementation that talks to the
 * ai-explorer-backend REST API.
 *
 * @public
 */
export class AiExplorerClient implements AiExplorerApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  private constructor(options: AiExplorerClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  static create(options: AiExplorerClientOptions): AiExplorerClient {
    return new AiExplorerClient(options);
  }

  private async baseUrl(): Promise<string> {
    return this.discoveryApi.getBaseUrl('ai-explorer');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = await this.baseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}${path}`, init);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return await response.json();
  }

  async listRules(query?: AiRuleQuery): Promise<AiRule[]> {
    const params = new URLSearchParams();
    if (query?.type) {
      params.set('type', query.type);
    }
    if (query?.enabled !== undefined) {
      params.set('enabled', String(query.enabled));
    }
    if (query?.limit !== undefined) {
      params.set('limit', String(query.limit));
    }
    if (query?.offset !== undefined) {
      params.set('offset', String(query.offset));
    }
    return this.request<AiRule[]>(`/rules?${params}`);
  }

  async createRule(
    rule: Omit<AiRule, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AiRule> {
    return this.request<AiRule>('/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
  }

  async updateRule(id: string, updates: Partial<AiRule>): Promise<void> {
    await this.request<void>(`/rules/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  }

  async deleteRule(id: string): Promise<void> {
    await this.request<void>(`/rules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async listSkills(query?: AiSkillQuery): Promise<AiSkill[]> {
    const params = new URLSearchParams();
    if (query?.search) {
      params.set('search', query.search);
    }
    if (query?.tags) {
      for (const tag of query.tags) {
        params.append('tags', tag);
      }
    }
    if (query?.limit !== undefined) {
      params.set('limit', String(query.limit));
    }
    if (query?.offset !== undefined) {
      params.set('offset', String(query.offset));
    }
    return this.request<AiSkill[]>(`/skills?${params}`);
  }

  async createSkill(
    skill: Omit<AiSkill, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AiSkill> {
    return this.request<AiSkill>('/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skill),
    });
  }

  async updateSkill(id: string, updates: Partial<AiSkill>): Promise<void> {
    await this.request<void>(`/skills/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  }

  async deleteSkill(id: string): Promise<void> {
    await this.request<void>(`/skills/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async listPlugins(): Promise<AiPlugin[]> {
    return this.request<AiPlugin[]>('/plugins');
  }

  async createPlugin(
    plugin: Omit<AiPlugin, 'id' | 'createdAt'>,
  ): Promise<AiPlugin> {
    return this.request<AiPlugin>('/plugins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plugin),
    });
  }
}
