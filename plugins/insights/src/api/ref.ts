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
  Aggregation,
  EventFilter,
  FeatureUsage,
  SearchAnalytics,
  UsageEvent,
} from '../types';

/**
 * API for interacting with the insights-backend REST API.
 *
 * @public
 */
export interface InsightsApi {
  /** Records a usage event. */
  recordEvent(event: UsageEvent): Promise<void>;
  /** Queries recorded usage events matching the given filter. */
  queryEvents(filter: EventFilter): Promise<UsageEvent[]>;
  /** Fetches pre-computed aggregations for a key and period. */
  getAggregations(
    key: string,
    period: string,
    from: string,
    to: string,
  ): Promise<Aggregation[]>;
  /** Fetches the most used features/targets. */
  getTopFeatures(): Promise<FeatureUsage[]>;
  /** Fetches search analytics, including popular and zero-result queries. */
  getSearchAnalytics(): Promise<SearchAnalytics>;
}

/**
 * {@link @backstage/core-plugin-api#ApiRef} for the {@link InsightsApi}.
 *
 * @public
 */
export const insightsApiRef = createApiRef<InsightsApi>({
  id: 'plugin.insights.api',
});
