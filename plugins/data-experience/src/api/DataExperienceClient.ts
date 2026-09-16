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
  DatasetAccessRequest,
  DatasetMetadata,
  WarehouseConnection,
} from '@backstage/plugin-data-experience-common';
import { DataExperienceApi } from './ref';

/**
 * Options for creating a {@link DataExperienceClient}.
 *
 * @public
 */
export interface DataExperienceClientOptions {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
}

/**
 * Default {@link DataExperienceApi} implementation that talks to the
 * data-experience-backend REST API.
 *
 * @public
 */
export class DataExperienceClient implements DataExperienceApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  private constructor(options: DataExperienceClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  static create(options: DataExperienceClientOptions): DataExperienceClient {
    return new DataExperienceClient(options);
  }

  private async baseUrl(): Promise<string> {
    return this.discoveryApi.getBaseUrl('data-experience');
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

  async getMetadata(entityRef: string): Promise<DatasetMetadata> {
    return this.request<DatasetMetadata>(
      `/datasets/${encodeURIComponent(entityRef)}/metadata`,
    );
  }

  async refreshMetadata(entityRef: string): Promise<void> {
    await this.request<void>(
      `/datasets/${encodeURIComponent(entityRef)}/metadata/refresh`,
      { method: 'POST' },
    );
  }

  async listWarehouses(): Promise<WarehouseConnection[]> {
    return this.request<WarehouseConnection[]>('/warehouses');
  }

  async listAccessRequests(
    datasetRef?: string,
  ): Promise<DatasetAccessRequest[]> {
    const params = new URLSearchParams();
    if (datasetRef) {
      params.set('datasetRef', datasetRef);
    }
    return this.request<DatasetAccessRequest[]>(`/access-requests?${params}`);
  }

  async requestAccess(
    datasetRef: string,
    reason: string,
  ): Promise<DatasetAccessRequest> {
    return this.request<DatasetAccessRequest>('/access-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasetRef, reason }),
    });
  }
}
