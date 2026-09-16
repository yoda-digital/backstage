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
import { AiAssistantClient, aiAssistantApiRef } from '../api/AiAssistantClient';

export { aikaAppModule } from '../modules/aikaAppModule';

/** @alpha */
export const rootRouteRef = createRouteRef();

/** @alpha */
export const aiAssistantApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: aiAssistantApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        AiAssistantClient.create({ discoveryApi, fetchApi }),
    }),
});

/** @alpha */
export const aiAssistantPage = PageBlueprint.make({
  params: {
    path: '/ai-assistant',
    title: 'AI Assistant',
    routeRef: rootRouteRef,
    loader: () => import('../components/ChatPage').then(m => <m.ChatPage />),
  },
});

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'ai-assistant',
  info: { packageJson: () => import('../../package.json') },
  routes: {
    root: rootRouteRef,
  },
  extensions: [aiAssistantApi, aiAssistantPage],
});
