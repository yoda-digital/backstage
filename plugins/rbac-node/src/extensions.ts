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

import { createExtensionPoint } from '@backstage/backend-plugin-api';
import type { RbacPolicy } from '@backstage/plugin-rbac-common';

/**
 * A provider that supplies RBAC policies from an external source.
 *
 * @public
 */
export interface RbacPolicyProvider {
  readonly providerId: string;
  loadPolicies(): Promise<RbacPolicy>;
  onChange?(callback: () => void): void;
}

/**
 * Extension point for registering custom RBAC policy providers.
 *
 * @public
 */
export interface RbacPolicyProviderExtensionPoint {
  addProvider(provider: RbacPolicyProvider): void;
}

/**
 * Extension point that modules can use to register custom RBAC policy providers.
 *
 * @public
 */
export const rbacPolicyProviderExtensionPoint =
  createExtensionPoint<RbacPolicyProviderExtensionPoint>({
    id: 'rbac.policy-provider',
  });
