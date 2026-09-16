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
import { SkillExchangeClient } from '../api/SkillExchangeClient';
import { skillExchangeApiRef } from '../api/ref';

/** @alpha */
export const rootRouteRef = createRouteRef();

/** @alpha */
export const gigDetailRouteRef = createRouteRef({ params: ['id'] });

/** @alpha */
export const profileRouteRef = createRouteRef();

/** @alpha */
export const skillExchangeApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: skillExchangeApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        SkillExchangeClient.create({ discoveryApi, fetchApi }),
    }),
});

/** @alpha */
export const marketplacePage = PageBlueprint.make({
  params: {
    path: '/skill-exchange',
    title: 'Skill Exchange',
    routeRef: rootRouteRef,
    loader: () =>
      import('../components/MarketplacePage').then(m => <m.MarketplacePage />),
  },
});

/** @alpha */
export const gigDetailPage = PageBlueprint.make({
  name: 'gig-detail',
  params: {
    path: '/skill-exchange/gigs/:id',
    title: 'Gig',
    routeRef: gigDetailRouteRef,
    loader: () => import('../components/GigDetail').then(m => <m.GigDetail />),
  },
});

/** @alpha */
export const profilePage = PageBlueprint.make({
  name: 'profile',
  params: {
    path: '/skill-exchange/profile',
    title: 'Skill Profile',
    routeRef: profileRouteRef,
    loader: () =>
      import('../components/ProfileEditor').then(m => <m.ProfileEditor />),
  },
});

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'skill-exchange',
  info: { packageJson: () => import('../../package.json') },
  routes: {
    root: rootRouteRef,
    gigDetail: gigDetailRouteRef,
    profile: profileRouteRef,
  },
  extensions: [skillExchangeApi, marketplacePage, gigDetailPage, profilePage],
});
