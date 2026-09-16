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

import { createRouteRef, PageBlueprint } from '@backstage/frontend-plugin-api';

/** @alpha */
export const rootRouteRef = createRouteRef();

/** @alpha */
export const modelsRouteRef = createRouteRef();

/** @alpha */
export const usageRouteRef = createRouteRef();

/** @alpha */
export const providersPage = PageBlueprint.make({
  params: {
    path: '/ai-gateway',
    title: 'AI Providers',
    routeRef: rootRouteRef,
    loader: () =>
      import('../components/ProvidersPage').then(m => <m.ProvidersPage />),
  },
});

/** @alpha */
export const modelsPage = PageBlueprint.make({
  name: 'models',
  params: {
    path: '/ai-gateway/models',
    title: 'AI Models',
    routeRef: modelsRouteRef,
    loader: () =>
      import('../components/ModelsPage').then(m => <m.ModelsPage />),
  },
});

/** @alpha */
export const usagePage = PageBlueprint.make({
  name: 'usage',
  params: {
    path: '/ai-gateway/usage',
    title: 'AI Usage',
    routeRef: usageRouteRef,
    loader: () => import('../components/UsagePage').then(m => <m.UsagePage />),
  },
});

export default [providersPage, modelsPage, usagePage];
