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

export { default } from './alpha/plugin';
export { GrowthBookClient } from './api/GrowthBookClient';
export { growthBookApiRef } from './api/ref';
export type {
  GrowthBookApi,
  GrowthBookFeature,
  GrowthBookFeatureEnvironment,
  GrowthBookFeatureValueType,
  CreateFeatureRequest,
  GrowthBookExperiment,
  GrowthBookExperimentStatus,
  GrowthBookExperimentVariation,
} from './api/ref';
export { FeaturesPage } from './components/FeaturesPage';
export { FeatureDetail } from './components/FeatureDetail';
export { ExperimentsPage } from './components/ExperimentsPage';
