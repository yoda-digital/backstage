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
  AiUsageMetrics,
  MetricDataPoint,
  MetricQuery,
  MetricSegment,
  SurveyDefinition,
  SurveyResponse,
} from '@backstage/plugin-devex-metrics-common';
import { DevexMetricsApi } from './ref';

/**
 * Options for creating a {@link MetricsClient}.
 *
 * @public
 */
export interface MetricsClientOptions {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
}

function applySegmentParams(
  params: URLSearchParams,
  segment: MetricSegment | undefined,
): void {
  if (segment?.entityRef) {
    params.set('entityRef', segment.entityRef);
  }
  if (segment?.team) {
    params.set('team', segment.team);
  }
}

function buildDoraParams(query: MetricQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set('metric', query.metric);
  params.set('from', query.timeRange.from);
  params.set('to', query.timeRange.to);
  params.set('granularity', query.timeRange.granularity);
  applySegmentParams(params, query.segment);
  return params;
}

/**
 * Default {@link DevexMetricsApi} implementation that talks to the
 * devex-metrics-backend REST API.
 *
 * @public
 */
export class MetricsClient implements DevexMetricsApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  private constructor(options: MetricsClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  static create(options: MetricsClientOptions): MetricsClient {
    return new MetricsClient(options);
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = await this.discoveryApi.getBaseUrl('devex-metrics');
    const response = await this.fetchApi.fetch(`${baseUrl}${path}`, init);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return await response.json();
  }

  async queryDora(query: MetricQuery): Promise<MetricDataPoint[]> {
    const params = buildDoraParams(query);
    const response = await this.fetchJson<{
      metric: string;
      points: MetricDataPoint[];
    }>(`/dora?${params}`);
    return response.points;
  }

  async getAiUsage(
    from: string,
    to: string,
    segment?: MetricSegment,
  ): Promise<AiUsageMetrics> {
    const params = new URLSearchParams({ from, to });
    applySegmentParams(params, segment);
    return this.fetchJson<AiUsageMetrics>(`/ai-usage?${params}`);
  }

  async listSurveys(): Promise<SurveyDefinition[]> {
    return this.fetchJson<SurveyDefinition[]>('/surveys');
  }

  async createSurvey(
    survey: Omit<SurveyDefinition, 'createdAt'>,
  ): Promise<void> {
    await this.fetchJson<void>('/surveys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(survey),
    });
  }

  async submitSurveyResponse(response: SurveyResponse): Promise<void> {
    await this.fetchJson<void>(`/surveys/${response.surveyId}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    });
  }

  async getSurveyResults(surveyId: string): Promise<SurveyResponse[]> {
    return this.fetchJson<SurveyResponse[]>(`/surveys/${surveyId}/results`);
  }
}
