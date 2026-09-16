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
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { DataExperienceClient } from '../api/DataExperienceClient';
import { dataExperienceApiRef } from '../api/ref';

/** @alpha */
export const rootRouteRef = createRouteRef();

/** @alpha */
export const datasetDetailRouteRef = createRouteRef({
  params: ['namespace', 'name'],
});

/** @alpha */
export const dataExperienceApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: dataExperienceApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        DataExperienceClient.create({ discoveryApi, fetchApi }),
    }),
});

/** @alpha */
export const datasetCatalogPage = PageBlueprint.make({
  params: {
    path: '/data-experience',
    title: 'Data Experience',
    routeRef: rootRouteRef,
    loader: () =>
      import('../components/DatasetCatalogPage').then(m => (
        <m.DatasetCatalogPage />
      )),
  },
});

/** @alpha */
export const datasetDetailPage = PageBlueprint.make({
  name: 'dataset-detail',
  params: {
    path: '/data-experience/:namespace/:name',
    title: 'Dataset',
    routeRef: datasetDetailRouteRef,
    loader: () =>
      import('../components/DatasetDetail').then(m => <m.DatasetDetail />),
  },
});

/** @alpha */
export const datasetLineageContent = EntityContentBlueprint.make({
  name: 'lineage',
  params: {
    path: '/lineage',
    title: 'Lineage',
    loader: () =>
      import('../components/EntityDatasetLineageContent').then(m => (
        <m.EntityDatasetLineageContent />
      )),
  },
});

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'data-experience',
  info: { packageJson: () => import('../../package.json') },
  routes: {
    root: rootRouteRef,
    datasetDetail: datasetDetailRouteRef,
  },
  extensions: [
    dataExperienceApi,
    datasetCatalogPage,
    datasetDetailPage,
    datasetLineageContent,
  ],
});
