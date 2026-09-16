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

import { createPermission } from '@backstage/plugin-permission-common';

/** The resource type for AI Gateway provider resources. */
export const AI_GATEWAY_RESOURCE_TYPE = 'ai-gateway-provider';

/** Permission required to administer AI Gateway providers. */
export const aiGatewayAdminPermission = createPermission({
  name: 'ai.gateway.admin',
  attributes: { action: 'update' },
  resourceType: AI_GATEWAY_RESOURCE_TYPE,
});

/** Permission required to send chat requests through the AI Gateway. */
export const aiGatewayChatPermission = createPermission({
  name: 'ai.gateway.chat',
  attributes: { action: 'create' },
});

/** Permission required to read AI Gateway usage records. */
export const aiGatewayUsageReadPermission = createPermission({
  name: 'ai.gateway.usage.read',
  attributes: { action: 'read' },
});

/** All permissions defined by the AI Gateway plugin. */
export const aiGatewayPermissions = [
  aiGatewayAdminPermission,
  aiGatewayChatPermission,
  aiGatewayUsageReadPermission,
];
