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
  CatalogBuilderProviderId,
  IngestionJob,
  IngestRequest,
  OrganizationInfo,
  ProviderInfo,
  RepositoryInfo,
} from '../types';
import { CatalogBuilderApi } from './ref';

/**
 * Options for creating a {@link CatalogBuilderClient}.
 *
 * @public
 */
export interface CatalogBuilderClientOptions {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
}

/**
 * Default {@link CatalogBuilderApi} implementation that talks to the
 * catalog-builder-backend REST API.
 *
 * @public
 */
export class CatalogBuilderClient implements CatalogBuilderApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  private constructor(options: CatalogBuilderClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  static create(options: CatalogBuilderClientOptions): CatalogBuilderClient {
    return new CatalogBuilderClient(options);
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = await this.discoveryApi.getBaseUrl('catalog-builder');
    const response = await this.fetchApi.fetch(`${baseUrl}${path}`, init);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return await response.json();
  }

  async listProviders(): Promise<ProviderInfo[]> {
    return this.fetchJson<ProviderInfo[]>('/providers');
  }

  async listOrganizations(
    provider: CatalogBuilderProviderId,
  ): Promise<OrganizationInfo[]> {
    return this.fetchJson<OrganizationInfo[]>(
      `/organizations?provider=${encodeURIComponent(provider)}`,
    );
  }

  async listRepositories(
    provider: CatalogBuilderProviderId,
    organization: string,
  ): Promise<RepositoryInfo[]> {
    return this.fetchJson<RepositoryInfo[]>(
      `/repositories?provider=${encodeURIComponent(
        provider,
      )}&organization=${encodeURIComponent(organization)}`,
    );
  }

  async ingest(request: IngestRequest): Promise<IngestionJob> {
    return this.fetchJson<IngestionJob>('/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  async getJob(id: string): Promise<IngestionJob> {
    return this.fetchJson<IngestionJob>(`/jobs/${encodeURIComponent(id)}`);
  }
}
