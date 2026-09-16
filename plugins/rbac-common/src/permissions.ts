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

/**
 * The resource type identifier for RBAC roles.
 *
 * @public
 */
export const RBAC_RESOURCE_TYPE = 'rbac-role';

/**
 * Permission to create RBAC roles.
 *
 * @public
 */
export const rbacRoleCreatePermission = createPermission({
  name: 'rbac.role.create',
  attributes: { action: 'create' },
});

/**
 * Permission to read RBAC roles.
 *
 * @public
 */
export const rbacRoleReadPermission = createPermission({
  name: 'rbac.role.read',
  attributes: { action: 'read' },
});

/**
 * Permission to update RBAC roles.
 *
 * @public
 */
export const rbacRoleUpdatePermission = createPermission({
  name: 'rbac.role.update',
  attributes: { action: 'update' },
});

/**
 * Permission to delete RBAC roles.
 *
 * @public
 */
export const rbacRoleDeletePermission = createPermission({
  name: 'rbac.role.delete',
  attributes: { action: 'delete' },
});

/**
 * All RBAC permissions.
 *
 * @public
 */
export const rbacPermissions = [
  rbacRoleCreatePermission,
  rbacRoleReadPermission,
  rbacRoleUpdatePermission,
  rbacRoleDeletePermission,
];
