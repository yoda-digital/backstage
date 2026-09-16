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
import { AiExplorerClient, aiExplorerApiRef } from '../api/AiExplorerClient';

/** @alpha */
export const rootRouteRef = createRouteRef();

/** @alpha */
export const skillsRouteRef = createRouteRef();

/** @alpha */
export const pluginsRouteRef = createRouteRef();

/** @alpha */
export const aiExplorerApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: aiExplorerApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        AiExplorerClient.create({ discoveryApi, fetchApi }),
    }),
});

/** @alpha */
export const rulesPage = PageBlueprint.make({
  params: {
    path: '/ai-explorer',
    title: 'AI Rules',
    routeRef: rootRouteRef,
    loader: () => import('../components/RulesPage').then(m => <m.RulesPage />),
  },
});

/** @alpha */
export const skillsPage = PageBlueprint.make({
  name: 'skills',
  params: {
    path: '/ai-explorer/skills',
    title: 'AI Skills',
    routeRef: skillsRouteRef,
    loader: () =>
      import('../components/SkillsPage').then(m => <m.SkillsPage />),
  },
});

/** @alpha */
export const pluginsPage = PageBlueprint.make({
  name: 'plugins',
  params: {
    path: '/ai-explorer/plugins',
    title: 'AI Plugins',
    routeRef: pluginsRouteRef,
    loader: () =>
      import('../components/PluginsPage').then(m => <m.PluginsPage />),
  },
});

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'ai-explorer',
  info: { packageJson: () => import('../../package.json') },
  routes: {
    rules: rootRouteRef,
    skills: skillsRouteRef,
    plugins: pluginsRouteRef,
  },
  extensions: [aiExplorerApi, rulesPage, skillsPage, pluginsPage],
});
