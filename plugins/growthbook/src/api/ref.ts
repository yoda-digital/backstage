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

/**
 * The value type of a {@link GrowthBookFeature}.
 *
 * @public
 */
export type GrowthBookFeatureValueType =
  | 'boolean'
  | 'string'
  | 'number'
  | 'json';

/**
 * A single environment-scoped configuration of a {@link GrowthBookFeature}.
 *
 * @public
 */
export interface GrowthBookFeatureEnvironment {
  enabled: boolean;
  rules: unknown[];
}

/**
 * A GrowthBook feature flag.
 *
 * @public
 */
export interface GrowthBookFeature {
  readonly id: string;
  readonly description: string;
  readonly valueType: GrowthBookFeatureValueType;
  readonly defaultValue: unknown;
  readonly environments: Record<string, GrowthBookFeatureEnvironment>;
  readonly tags: string[];
}

/**
 * The payload used to create a new {@link GrowthBookFeature}.
 *
 * @public
 */
export interface CreateFeatureRequest {
  readonly id: string;
  readonly description: string;
  readonly valueType: GrowthBookFeatureValueType;
  readonly defaultValue: unknown;
  readonly tags?: string[];
}

/**
 * The lifecycle status of a {@link GrowthBookExperiment}.
 *
 * @public
 */
export type GrowthBookExperimentStatus = 'draft' | 'running' | 'stopped';

/**
 * A single variation of a {@link GrowthBookExperiment}.
 *
 * @public
 */
export interface GrowthBookExperimentVariation {
  name: string;
  value: unknown;
}

/**
 * A GrowthBook experiment.
 *
 * @public
 */
export interface GrowthBookExperiment {
  readonly id: string;
  readonly name: string;
  readonly status: GrowthBookExperimentStatus;
  readonly variations: GrowthBookExperimentVariation[];
  readonly targetingCondition?: string;
}

/**
 * API for interacting with the growthbook-backend proxy REST API.
 *
 * @public
 */
export interface GrowthBookApi {
  /** Lists all feature flags. */
  listFeatures(): Promise<GrowthBookFeature[]>;
  /** Fetches a single feature flag by id. */
  getFeature(id: string): Promise<GrowthBookFeature>;
  /** Creates a new feature flag. */
  createFeature(feature: CreateFeatureRequest): Promise<void>;
  /** Updates an existing feature flag. */
  updateFeature(id: string, updates: Partial<GrowthBookFeature>): Promise<void>;
  /** Lists all experiments. */
  listExperiments(): Promise<GrowthBookExperiment[]>;
  /** Fetches a single experiment by id. */
  getExperiment(id: string): Promise<GrowthBookExperiment>;
}

/**
 * {@link @backstage/core-plugin-api#ApiRef} for the {@link GrowthBookApi}.
 *
 * @public
 */
export const growthBookApiRef = createApiRef<GrowthBookApi>({
  id: 'plugin.growthbook.api',
});
