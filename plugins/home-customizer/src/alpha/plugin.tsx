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
  createFrontendPlugin,
  createRouteRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';

/** @alpha */
export const rootRouteRef = createRouteRef();

/** @alpha */
export const homeCustomizerPage = PageBlueprint.make({
  params: {
    path: '/home-customizer',
    title: 'Home Customizer',
    routeRef: rootRouteRef,
    loader: () =>
      import('../components/HomeCustomizerPage').then(m => (
        <m.HomeCustomizerPage />
      )),
  },
});

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'home-customizer',
  info: { packageJson: () => import('../../package.json') },
  routes: {
    root: rootRouteRef,
  },
  extensions: [homeCustomizerPage],
});
