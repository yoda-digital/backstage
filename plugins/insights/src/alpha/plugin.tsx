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
import { insightsApiRef } from '../api/ref';
import { InsightsClient } from '../api/InsightsClient';

/** @alpha */
export const rootRouteRef = createRouteRef();

/** @alpha */
export const insightsApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: insightsApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        InsightsClient.create({ discoveryApi, fetchApi }),
    }),
});

/** @alpha */
export const insightsPage = PageBlueprint.make({
  params: {
    path: '/insights',
    title: 'Insights',
    routeRef: rootRouteRef,
    loader: () =>
      import('../components/InsightsDashboard').then(m => (
        <m.InsightsDashboard />
      )),
  },
});

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'insights',
  info: { packageJson: () => import('../../package.json') },
  routes: {
    root: rootRouteRef,
  },
  extensions: [insightsApi, insightsPage],
});
