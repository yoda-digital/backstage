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
  discoveryApiRef,
  fetchApiRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { fleetshiftApiRef } from '../api/ref';
import { FleetshiftClient } from '../api/FleetshiftClient';
import { newShiftRouteRef, rootRouteRef, shiftDetailRouteRef } from '../routes';

/** @alpha */
export const fleetshiftApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: fleetshiftApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        FleetshiftClient.create({ discoveryApi, fetchApi }),
    }),
});

/** @alpha */
export const shiftDashboardPage = PageBlueprint.make({
  params: {
    path: '/fleetshift',
    title: 'Fleetshift',
    routeRef: rootRouteRef,
    loader: () =>
      import('../components/ShiftDashboard').then(m => <m.ShiftDashboard />),
  },
});

/** @alpha */
export const createShiftPage = PageBlueprint.make({
  name: 'new',
  params: {
    path: '/fleetshift/new',
    title: 'New Shift',
    routeRef: newShiftRouteRef,
    loader: () =>
      import('../components/CreateShiftPage').then(m => <m.CreateShiftPage />),
  },
});

/** @alpha */
export const shiftDetailPage = PageBlueprint.make({
  name: 'detail',
  params: {
    path: '/fleetshift/:id',
    title: 'Shift Detail',
    routeRef: shiftDetailRouteRef,
    loader: () =>
      import('../components/ShiftDetail').then(m => <m.ShiftDetail />),
  },
});

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'fleetshift',
  info: { packageJson: () => import('../../package.json') },
  routes: {
    root: rootRouteRef,
    new: newShiftRouteRef,
    detail: shiftDetailRouteRef,
  },
  extensions: [
    fleetshiftApi,
    shiftDashboardPage,
    createShiftPage,
    shiftDetailPage,
  ],
});
