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

import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import {
  CreateFeatureRequest,
  GrowthBookApi,
  GrowthBookExperiment,
  GrowthBookFeature,
} from './ref';

/**
 * Options for creating a {@link GrowthBookClient}.
 *
 * @public
 */
export interface GrowthBookClientOptions {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
}

/**
 * Default {@link GrowthBookApi} implementation that talks to the
 * growthbook-backend proxy REST API.
 *
 * @public
 */
export class GrowthBookClient implements GrowthBookApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  private constructor(options: GrowthBookClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  static create(options: GrowthBookClientOptions): GrowthBookClient {
    return new GrowthBookClient(options);
  }

  private async baseUrl(): Promise<string> {
    return this.discoveryApi.getBaseUrl('growthbook');
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

  async listFeatures(): Promise<GrowthBookFeature[]> {
    return this.request<GrowthBookFeature[]>('/features');
  }

  async getFeature(id: string): Promise<GrowthBookFeature> {
    return this.request<GrowthBookFeature>(
      `/features/${encodeURIComponent(id)}`,
    );
  }

  async createFeature(feature: CreateFeatureRequest): Promise<void> {
    await this.request<void>('/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feature),
    });
  }

  async updateFeature(
    id: string,
    updates: Partial<GrowthBookFeature>,
  ): Promise<void> {
    await this.request<void>(`/features/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  }

  async listExperiments(): Promise<GrowthBookExperiment[]> {
    return this.request<GrowthBookExperiment[]>('/experiments');
  }

  async getExperiment(id: string): Promise<GrowthBookExperiment> {
    return this.request<GrowthBookExperiment>(
      `/experiments/${encodeURIComponent(id)}`,
    );
  }
}
