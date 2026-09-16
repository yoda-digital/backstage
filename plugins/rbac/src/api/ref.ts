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

import { createApiRef } from '@backstage/core-plugin-api';
import {
  RbacPolicyRecord,
  RbacPolicyRule,
  RbacPolicyStrategy,
  RbacRole,
  RbacRoleBinding,
  RbacSubject,
} from '@backstage/plugin-rbac-common';

/**
 * An {@link RbacPolicyRecord} together with the roles that are scoped to it,
 * as returned by the single-policy read endpoint.
 *
 * @public
 */
export interface RbacPolicyWithRoles extends RbacPolicyRecord {
  readonly roles: RbacRole[];
}

/**
 * A single rule considered while testing a policy against a simulated
 * request, and the outcome of matching it.
 *
 * @public
 */
export interface RbacPolicyTestChainEntry {
  readonly source: string;
  readonly rule: RbacPolicyRule;
  readonly matched: boolean;
  readonly decision?: 'ALLOW' | 'DENY' | 'CONDITIONAL';
}

/**
 * The result of testing a policy against a simulated request, as returned by
 * the policy tester endpoint.
 *
 * @public
 */
export interface RbacPolicyTestResult {
  readonly decision: 'ALLOW' | 'DENY' | 'CONDITIONAL';
  readonly matchedRole?: string;
  readonly matchedRule?: RbacPolicyRule;
  readonly evaluationChain: RbacPolicyTestChainEntry[];
  readonly policyId: string;
  readonly userRef: string;
  readonly permission: string;
  readonly resourceRef?: string;
}

/**
 * Input accepted when creating a new RBAC policy draft.
 *
 * @public
 */
export interface CreateRbacPolicyInput {
  name: string;
  strategy?: RbacPolicyStrategy;
}

/**
 * Input accepted when updating an existing (draft) RBAC policy.
 *
 * @public
 */
export interface UpdateRbacPolicyInput {
  name?: string;
  strategy?: RbacPolicyStrategy;
  rules?: RbacPolicyRule[];
}

/**
 * Input accepted by the policy tester endpoint.
 *
 * @public
 */
export interface TestRbacPolicyInput {
  userRef: string;
  permission: string;
  resourceRef?: string;
}

/**
 * Client interface for interacting with the RBAC backend, exposing role,
 * role binding, and policy lifecycle management operations.
 *
 * @public
 */
export interface RbacApi {
  listRoles(): Promise<RbacRole[]>;
  getRole(name: string): Promise<RbacRole>;
  createRole(role: Omit<RbacRole, 'metadata'>): Promise<void>;
  updateRole(name: string, role: Partial<RbacRole>): Promise<void>;
  deleteRole(name: string): Promise<void>;
  listBindings(role?: string): Promise<RbacRoleBinding[]>;
  addBinding(role: string, subject: RbacSubject): Promise<void>;
  removeBinding(role: string, subject: RbacSubject): Promise<void>;
  listPolicies(): Promise<RbacPolicyRecord[]>;
  getPolicy(id: string): Promise<RbacPolicyWithRoles>;
  createPolicy(input: CreateRbacPolicyInput): Promise<RbacPolicyRecord>;
  updatePolicy(
    id: string,
    input: UpdateRbacPolicyInput,
  ): Promise<RbacPolicyRecord>;
  deletePolicy(id: string): Promise<void>;
  publishPolicy(id: string): Promise<RbacPolicyRecord>;
  republishPolicy(id: string): Promise<RbacPolicyRecord>;
  testPolicy(
    id: string,
    input: TestRbacPolicyInput,
  ): Promise<RbacPolicyTestResult>;
  exportPolicy(id: string): Promise<string>;
  importPolicy(content: string): Promise<RbacPolicyRecord>;
}

/**
 * API reference for the {@link RbacApi}.
 *
 * @public
 */
export const rbacApiRef = createApiRef<RbacApi>({ id: 'plugin.rbac.api' });
