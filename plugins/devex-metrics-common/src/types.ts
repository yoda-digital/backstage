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

/**
 * The four DORA metrics, each expressed as a time series of data points.
 *
 * @public
 */
export interface DoraMetrics {
  readonly deploymentFrequency: MetricDataPoint[];
  readonly leadTimeForChanges: MetricDataPoint[];
  readonly meanTimeToRestore: MetricDataPoint[];
  readonly changeFailureRate: MetricDataPoint[];
}

/**
 * A single measured value for a metric, optionally scoped to an entity or team.
 *
 * @public
 */
export interface MetricDataPoint {
  readonly date: string;
  readonly value: number;
  readonly entityRef?: string;
  readonly team?: string;
}

/**
 * The identifiers of the individual DORA metrics.
 *
 * @public
 */
export type DoraMetricName =
  | 'deployment_frequency'
  | 'lead_time_for_changes'
  | 'mean_time_to_restore'
  | 'change_failure_rate';

/**
 * A bounded range of time used to scope a metric query or report.
 *
 * @public
 */
export interface MetricTimeRange {
  readonly from: string;
  readonly to: string;
  readonly granularity: 'day' | 'week' | 'month';
}

/**
 * A query used to request metric data points for a given metric and time range.
 *
 * @public
 */
export interface MetricQuery {
  readonly metric: DoraMetricName;
  readonly timeRange: MetricTimeRange;
  readonly segment?: MetricSegment;
}

/**
 * Scopes a metric query or data point to a subset of entities, such as a team
 * or an individual entity.
 *
 * @public
 */
export interface MetricSegment {
  readonly entityRef?: string;
  readonly team?: string;
}

/**
 * Aggregate AI usage metrics, broken down by provider and user.
 *
 * @public
 */
export interface AiUsageMetrics {
  readonly totalRequests: number;
  readonly totalTokens: number;
  readonly byProvider: Record<string, { requests: number; tokens: number }>;
  readonly byUser: Record<string, { requests: number; tokens: number }>;
  readonly dataPoints: MetricDataPoint[];
}

/**
 * The definition of a developer experience survey.
 *
 * @public
 */
export interface SurveyDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly questions: SurveyQuestion[];
  readonly active: boolean;
  readonly createdAt: string;
}

/**
 * A single question within a {@link SurveyDefinition}.
 *
 * @public
 */
export interface SurveyQuestion {
  readonly id: string;
  readonly text: string;
  readonly type: 'rating' | 'text' | 'choice';
  readonly options?: string[];
  readonly required: boolean;
}

/**
 * A respondent's answers to a {@link SurveyDefinition}.
 *
 * @public
 */
export interface SurveyResponse {
  readonly surveyId: string;
  readonly respondent: string;
  readonly answers: Record<string, string | number>;
  readonly submittedAt: string;
}
