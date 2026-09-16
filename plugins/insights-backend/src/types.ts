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

/** @internal */
export interface InsightsEvent {
  readonly id?: number;
  readonly eventType: string;
  readonly userRef: string;
  readonly target?: string;
  readonly metadata?: Record<string, unknown>;
  readonly timestamp?: string;
}

/** @internal */
export interface EventFilter {
  readonly eventType?: string;
  readonly userRef?: string;
  readonly target?: string;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
}

/** @internal */
export interface AggregationBucket {
  readonly key: string;
  readonly period: string;
  readonly count: number;
  readonly periodStart: string;
}
