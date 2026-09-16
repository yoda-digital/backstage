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
  PageBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import { AuditLogClient } from './api/AuditLogClient';
import { auditLogApiRef } from './api/ref';

/** @alpha */
export const auditLogApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: auditLogApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        AuditLogClient.create({ discoveryApi, fetchApi }),
    }),
});

/** @alpha */
export const auditLogPage = PageBlueprint.make({
  params: {
    path: '/audit-log',
    title: 'Audit Log',
    loader: () =>
      import('./components/AuditLogPage').then(m => <m.AuditLogPage />),
  },
});

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'audit-log',
  info: { packageJson: () => import('../package.json') },
  extensions: [auditLogApi, auditLogPage],
});
