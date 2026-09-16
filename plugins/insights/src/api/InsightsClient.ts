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
  Aggregation,
  EventFilter,
  FeatureUsage,
  SearchAnalytics,
  UsageEvent,
} from '../types';
import { InsightsApi } from './ref';

/**
 * Options for creating an {@link InsightsClient}.
 *
 * @public
 */
export interface InsightsClientOptions {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
}

function buildEventParams(filter: EventFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.eventType) {
    params.set('eventType', filter.eventType);
  }
  if (filter.userRef) {
    params.set('userRef', filter.userRef);
  }
  if (filter.target) {
    params.set('target', filter.target);
  }
  if (filter.from) {
    params.set('from', filter.from);
  }
  if (filter.to) {
    params.set('to', filter.to);
  }
  return params;
}

/**
 * Default {@link InsightsApi} implementation that talks to the
 * insights-backend REST API.
 *
 * @public
 */
export class InsightsClient implements InsightsApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  private constructor(options: InsightsClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  static create(options: InsightsClientOptions): InsightsClient {
    return new InsightsClient(options);
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = await this.discoveryApi.getBaseUrl('insights');
    const response = await this.fetchApi.fetch(`${baseUrl}${path}`, init);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return await response.json();
  }

  async recordEvent(event: UsageEvent): Promise<void> {
    await this.fetchJson<void>('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  }

  async queryEvents(filter: EventFilter): Promise<UsageEvent[]> {
    const params = buildEventParams(filter);
    return this.fetchJson<UsageEvent[]>(`/events?${params}`);
  }

  async getAggregations(
    key: string,
    period: string,
    from: string,
    to: string,
  ): Promise<Aggregation[]> {
    const params = new URLSearchParams({ key, period, from, to });
    return this.fetchJson<Aggregation[]>(`/aggregations?${params}`);
  }

  async getTopFeatures(): Promise<FeatureUsage[]> {
    return this.fetchJson<FeatureUsage[]>('/top-features');
  }

  async getSearchAnalytics(): Promise<SearchAnalytics> {
    return this.fetchJson<SearchAnalytics>('/search-analytics');
  }
}
