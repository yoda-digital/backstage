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
  EntityOverlay,
  OverlayApplyResult,
  OverlayPatch,
} from '@backstage/plugin-entity-overlays-common';
import { OverlayApi } from './ref';

/**
 * Options for creating an {@link OverlayClient}.
 * @public
 */
export interface OverlayClientOptions {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
}

/**
 * Default HTTP client implementation of the {@link OverlayApi}.
 * @public
 */
export class OverlayClient implements OverlayApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  private constructor(options: OverlayClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  static create(options: OverlayClientOptions): OverlayClient {
    return new OverlayClient(options);
  }

  private async getBaseUrl(): Promise<string> {
    return this.discoveryApi.getBaseUrl('entity-overlays');
  }

  async listOverlays(): Promise<EntityOverlay[]> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/overlays`);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return (await response.json()) as EntityOverlay[];
  }

  async getOverlay(entityRef: string): Promise<EntityOverlay | undefined> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/overlays/${encodeURIComponent(entityRef)}`,
    );
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return (await response.json()) as EntityOverlay;
  }

  async setOverlay(
    entityRef: string,
    patches: OverlayPatch[],
  ): Promise<OverlayApplyResult> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/overlays/${encodeURIComponent(entityRef)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patches }),
      },
    );
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return (await response.json()) as OverlayApplyResult;
  }

  async deleteOverlay(entityRef: string): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/overlays/${encodeURIComponent(entityRef)}`,
      { method: 'DELETE' },
    );
    if (!response.ok && response.status !== 404) {
      throw await ResponseError.fromResponse(response);
    }
  }
}
