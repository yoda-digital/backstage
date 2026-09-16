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

import {
  ApiBlueprint,
  createFrontendPlugin,
  createRouteRef,
  discoveryApiRef,
  fetchApiRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { GrowthBookClient } from '../api/GrowthBookClient';
import { growthBookApiRef } from '../api/ref';

/** @alpha */
export const rootRouteRef = createRouteRef();

/** @alpha */
export const featureDetailRouteRef = createRouteRef({ params: ['id'] });

/** @alpha */
export const experimentsRouteRef = createRouteRef();

/** @alpha */
export const growthBookApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: growthBookApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        GrowthBookClient.create({ discoveryApi, fetchApi }),
    }),
});

/** @alpha */
export const featuresPage = PageBlueprint.make({
  params: {
    path: '/growthbook',
    title: 'GrowthBook',
    routeRef: rootRouteRef,
    loader: () =>
      import('../components/FeaturesPage').then(m => <m.FeaturesPage />),
  },
});

/** @alpha */
export const featureDetailPage = PageBlueprint.make({
  name: 'feature-detail',
  params: {
    path: '/growthbook/features/:id',
    title: 'Feature',
    routeRef: featureDetailRouteRef,
    loader: () =>
      import('../components/FeatureDetail').then(m => <m.FeatureDetail />),
  },
});

/** @alpha */
export const experimentsPage = PageBlueprint.make({
  name: 'experiments',
  params: {
    path: '/growthbook/experiments',
    title: 'Experiments',
    routeRef: experimentsRouteRef,
    loader: () =>
      import('../components/ExperimentsPage').then(m => <m.ExperimentsPage />),
  },
});

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'growthbook',
  info: { packageJson: () => import('../../package.json') },
  routes: {
    root: rootRouteRef,
    featureDetail: featureDetailRouteRef,
    experiments: experimentsRouteRef,
  },
  extensions: [growthBookApi, featuresPage, featureDetailPage, experimentsPage],
});
