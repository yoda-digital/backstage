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

import { createApiRef } from '@backstage/core-plugin-api';
import {
  AiUsageMetrics,
  MetricDataPoint,
  MetricQuery,
  MetricSegment,
  SurveyDefinition,
  SurveyResponse,
} from '@backstage/plugin-devex-metrics-common';

/**
 * API for interacting with the devex-metrics-backend REST API.
 *
 * @public
 */
export interface DevexMetricsApi {
  /** Queries DORA metric data points for the given metric, time range, and segment. */
  queryDora(query: MetricQuery): Promise<MetricDataPoint[]>;
  /** Fetches aggregate AI usage metrics for the given time range and segment. */
  getAiUsage(
    from: string,
    to: string,
    segment?: MetricSegment,
  ): Promise<AiUsageMetrics>;
  /** Lists all developer experience surveys. */
  listSurveys(): Promise<SurveyDefinition[]>;
  /** Creates a new survey. */
  createSurvey(survey: Omit<SurveyDefinition, 'createdAt'>): Promise<void>;
  /** Submits a response to a survey. */
  submitSurveyResponse(response: SurveyResponse): Promise<void>;
  /** Fetches all responses submitted for a survey. */
  getSurveyResults(surveyId: string): Promise<SurveyResponse[]>;
}

/**
 * {@link @backstage/core-plugin-api#ApiRef} for the {@link DevexMetricsApi}.
 *
 * @public
 */
export const devexMetricsApiRef = createApiRef<DevexMetricsApi>({
  id: 'plugin.devex-metrics.api',
});
