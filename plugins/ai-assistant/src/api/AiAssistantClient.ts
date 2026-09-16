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
  AiConversation,
  AiAssistantMessage,
  AiMode,
  AiSuggestion,
  ConversationQuery,
  CreateConversationRequest,
  CreateModeRequest,
  SendMessageRequest,
  UpdateModeRequest,
} from '@backstage/plugin-ai-assistant-common';

/**
 * API for interacting with the ai-assistant-backend REST API.
 *
 * @public
 */
export interface AiAssistantApi {
  /** Lists the AiKA modes available to the user: built-in modes, public modes, and their own. */
  listModes(): Promise<AiMode[]>;
  /** Lists the top 5 modes by usage over the last 30 days, visible to the user. */
  getPopularModes(): Promise<AiMode[]>;
  /** Creates a new mode, owned by the current user. */
  createMode(mode: CreateModeRequest): Promise<AiMode>;
  /** Updates a mode owned by the current user. */
  updateMode(id: string, mode: UpdateModeRequest): Promise<AiMode>;
  /** Deletes a mode owned by the current user. */
  deleteMode(id: string): Promise<void>;
  /** Fetches the contextual suggestion chips registered for the given route. */
  getSuggestions(route: string): Promise<AiSuggestion[]>;
  /** Lists conversations, optionally filtered by the given query. */
  listConversations(query?: ConversationQuery): Promise<AiConversation[]>;
  /** Fetches a single conversation, including its messages. */
  getConversation(id: string): Promise<AiConversation>;
  /** Creates a new conversation in the given mode. */
  createConversation(
    request: CreateConversationRequest,
  ): Promise<AiConversation>;
  /** Sends a message within an existing conversation and returns the reply. */
  sendMessage(
    conversationId: string,
    request: SendMessageRequest,
  ): Promise<AiAssistantMessage>;
}

/**
 * {@link @backstage/core-plugin-api#ApiRef} for the {@link AiAssistantApi}.
 *
 * @public
 */
export const aiAssistantApiRef = createApiRef<AiAssistantApi>({
  id: 'plugin.ai-assistant.service',
});

/**
 * Options for creating an {@link AiAssistantClient}.
 *
 * @public
 */
export interface AiAssistantClientOptions {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
}

/**
 * Default {@link AiAssistantApi} implementation that talks to the
 * ai-assistant-backend REST API.
 *
 * @public
 */
export class AiAssistantClient implements AiAssistantApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  private constructor(options: AiAssistantClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  static create(options: AiAssistantClientOptions): AiAssistantClient {
    return new AiAssistantClient(options);
  }

  private async baseUrl(): Promise<string> {
    return this.discoveryApi.getBaseUrl('ai-assistant');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = await this.baseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}${path}`, init);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return await response.json();
  }

  async listModes(): Promise<AiMode[]> {
    return this.request<AiMode[]>('/modes');
  }

  async getPopularModes(): Promise<AiMode[]> {
    return this.request<AiMode[]>('/modes/popular');
  }

  async createMode(mode: CreateModeRequest): Promise<AiMode> {
    return this.request<AiMode>('/modes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode),
    });
  }

  async updateMode(id: string, mode: UpdateModeRequest): Promise<AiMode> {
    return this.request<AiMode>(`/modes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode),
    });
  }

  async deleteMode(id: string): Promise<void> {
    const baseUrl = await this.baseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/modes/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
  }

  async getSuggestions(route: string): Promise<AiSuggestion[]> {
    return this.request<AiSuggestion[]>(
      `/suggestions?route=${encodeURIComponent(route)}`,
    );
  }

  async listConversations(
    query?: ConversationQuery,
  ): Promise<AiConversation[]> {
    const params = new URLSearchParams();
    if (query?.userEntityRef) {
      params.set('userEntityRef', query.userEntityRef);
    }
    if (query?.modeId) {
      params.set('modeId', query.modeId);
    }
    if (query?.limit !== undefined) {
      params.set('limit', String(query.limit));
    }
    if (query?.offset !== undefined) {
      params.set('offset', String(query.offset));
    }
    return this.request<AiConversation[]>(`/conversations?${params}`);
  }

  async getConversation(id: string): Promise<AiConversation> {
    return this.request<AiConversation>(
      `/conversations/${encodeURIComponent(id)}`,
    );
  }

  async createConversation(
    request: CreateConversationRequest,
  ): Promise<AiConversation> {
    return this.request<AiConversation>('/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  async sendMessage(
    conversationId: string,
    request: SendMessageRequest,
  ): Promise<AiAssistantMessage> {
    return this.request<AiAssistantMessage>(
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
    );
  }
}
