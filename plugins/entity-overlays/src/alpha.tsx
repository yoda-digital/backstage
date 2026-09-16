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
} from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { overlayApiRef } from './api/ref';
import { OverlayClient } from './api/OverlayClient';

/** @alpha */
export const overlayApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: overlayApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        OverlayClient.create({ discoveryApi, fetchApi }),
    }),
});

/** @alpha */
export const overlayEntityContent = EntityContentBlueprint.make({
  name: 'overlays',
  params: {
    path: '/overlays',
    title: 'Overlays',
    loader: () =>
      import('./components/OverlayEditor').then(m => <m.OverlayEditor />),
  },
});

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'entity-overlays',
  info: { packageJson: () => import('../package.json') },
  extensions: [overlayApi, overlayEntityContent],
});
