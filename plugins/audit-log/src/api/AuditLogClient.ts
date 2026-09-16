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
  AuditQuery,
  AuditQueryResult,
} from '@backstage/plugin-audit-log-common';
import { AuditLogApi } from './ref';

/**
 * Options for creating a {@link AuditLogClient}.
 *
 * @public
 */
export interface AuditLogClientOptions {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
}

/**
 * Default {@link AuditLogApi} implementation that talks to the
 * audit-log-backend REST API.
 *
 * @public
 */
export class AuditLogClient implements AuditLogApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  private constructor(options: AuditLogClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  static create(options: AuditLogClientOptions): AuditLogClient {
    return new AuditLogClient(options);
  }

  async queryEvents(query: AuditQuery): Promise<AuditQueryResult> {
    const baseUrl = await this.discoveryApi.getBaseUrl('audit-log');
    const params = new URLSearchParams();

    if (query.actor) {
      params.set('actor', query.actor);
    }
    if (query.entityRef) {
      params.set('entityRef', query.entityRef);
    }
    if (query.action) {
      params.set('action', query.action);
    }
    if (query.severity) {
      params.set('severity', query.severity);
    }
    if (query.pluginId) {
      params.set('pluginId', query.pluginId);
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

    const queryString = params.toString();
    const url = `${baseUrl}/events${queryString ? `?${queryString}` : ''}`;

    const response = await this.fetchApi.fetch(url);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }

    return await response.json();
  }
}
