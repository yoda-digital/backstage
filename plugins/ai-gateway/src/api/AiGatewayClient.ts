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
  AiProviderInfo,
  AiModel,
  AiUsageRecord,
  AiUsageQuery,
  AiUsageSummary,
} from '@backstage/plugin-ai-gateway-common';

/**
 * API for interacting with the ai-gateway-backend REST API.
 *
 * @public
 */
export interface AiGatewayApi {
  /** Lists all registered AI providers and their connection status. */
  listProviders(): Promise<AiProviderInfo[]>;
  /** Lists all models exposed by registered providers. */
  listModels(): Promise<AiModel[]>;
  /** Fetches raw usage records matching the given query. */
  getUsage(query: AiUsageQuery): Promise<AiUsageRecord[]>;
  /** Fetches an aggregated usage summary matching the given query. */
  getUsageSummary(query: AiUsageQuery): Promise<AiUsageSummary>;
}

/**
 * {@link @backstage/core-plugin-api#ApiRef} for the {@link AiGatewayApi}.
 *
 * @public
 */
export const aiGatewayApiRef = createApiRef<AiGatewayApi>({
  id: 'plugin.ai-gateway.service',
});

/**
 * Options for creating an {@link AiGatewayClient}.
 *
 * @public
 */
export interface AiGatewayClientOptions {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
}

function buildUsageParams(query: AiUsageQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.providerId) {
    params.set('providerId', query.providerId);
  }
  if (query.modelId) {
    params.set('modelId', query.modelId);
  }
  if (query.userEntityRef) {
    params.set('userEntityRef', query.userEntityRef);
  }
  if (query.from) {
    params.set('from', query.from);
  }
  if (query.to) {
    params.set('to', query.to);
  }
  if (query.limit !== undefined) {
    params.set('limit', String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set('offset', String(query.offset));
  }
  return params;
}

/**
 * Default {@link AiGatewayApi} implementation that talks to the
 * ai-gateway-backend REST API.
 *
 * @public
 */
export class AiGatewayClient implements AiGatewayApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  private constructor(options: AiGatewayClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  static create(options: AiGatewayClientOptions): AiGatewayClient {
    return new AiGatewayClient(options);
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const baseUrl = await this.discoveryApi.getBaseUrl('ai-gateway');
    const response = await this.fetchApi.fetch(`${baseUrl}${path}`);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return await response.json();
  }

  async listProviders(): Promise<AiProviderInfo[]> {
    return this.fetchJson<AiProviderInfo[]>('/providers');
  }

  async listModels(): Promise<AiModel[]> {
    return this.fetchJson<AiModel[]>('/models');
  }

  async getUsage(query: AiUsageQuery): Promise<AiUsageRecord[]> {
    const params = buildUsageParams(query);
    return this.fetchJson<AiUsageRecord[]>(`/usage?${params}`);
  }

  async getUsageSummary(query: AiUsageQuery): Promise<AiUsageSummary> {
    const params = buildUsageParams(query);
    return this.fetchJson<AiUsageSummary>(`/usage/summary?${params}`);
  }
}
