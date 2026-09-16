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
 * A single recorded usage event, such as a page view or a feature
 * interaction.
 *
 * @public
 */
export interface UsageEvent {
  readonly id?: number;
  readonly eventType: string;
  readonly userRef: string;
  readonly target?: string;
  readonly metadata?: Record<string, unknown>;
  readonly timestamp?: string;
}

/**
 * Filters accepted by the events query endpoint.
 *
 * @public
 */
export interface EventFilter {
  readonly eventType?: string;
  readonly userRef?: string;
  readonly target?: string;
  readonly from?: string;
  readonly to?: string;
}

/**
 * A pre-computed aggregation bucket for a given key and period.
 *
 * @public
 */
export interface Aggregation {
  readonly key: string;
  readonly period: string;
  readonly count: number;
  readonly periodStart: string;
}

/**
 * A single entry describing how often a feature or target has been used.
 *
 * @public
 */
export interface FeatureUsage {
  readonly target: string;
  readonly count: number;
}

/**
 * A single search query and how often it occurred.
 *
 * @public
 */
export interface SearchQueryCount {
  readonly query: string;
  readonly count: number;
}

/**
 * Aggregate search analytics, including the most popular queries and those
 * that returned no results.
 *
 * @public
 */
export interface SearchAnalytics {
  readonly popularQueries: SearchQueryCount[];
  readonly zeroResultQueries: SearchQueryCount[];
}
