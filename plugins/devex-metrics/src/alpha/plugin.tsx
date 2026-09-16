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
import { devexMetricsApiRef } from '../api/ref';
import { MetricsClient } from '../api/MetricsClient';

/** @alpha */
export const rootRouteRef = createRouteRef();

/** @alpha */
export const surveysRouteRef = createRouteRef();

/** @alpha */
export const devexMetricsApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: devexMetricsApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        MetricsClient.create({ discoveryApi, fetchApi }),
    }),
});

/** @alpha */
export const doraPage = PageBlueprint.make({
  params: {
    path: '/devex-metrics',
    title: 'DevEx Metrics',
    routeRef: rootRouteRef,
    loader: () =>
      import('../components/DoraDashboard').then(m => <m.DoraDashboard />),
  },
});

/** @alpha */
export const surveysPage = PageBlueprint.make({
  name: 'surveys',
  params: {
    path: '/devex-metrics/surveys',
    title: 'Surveys',
    routeRef: surveysRouteRef,
    loader: () =>
      import('../components/SurveyPage').then(m => <m.SurveyPage />),
  },
});

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'devex-metrics',
  info: { packageJson: () => import('../../package.json') },
  routes: {
    root: rootRouteRef,
    surveys: surveysRouteRef,
  },
  extensions: [devexMetricsApi, doraPage, surveysPage],
});
