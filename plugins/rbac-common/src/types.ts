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

/**
 * A condition attached to an RBAC policy rule that constrains
 * when the rule applies.
 *
 * @public
 */
export interface RbacCondition {
  readonly rule: string;
  readonly params: Record<string, unknown>;
}

/**
 * A single permission rule within an RBAC role, specifying
 * whether a given permission is allowed or denied.
 *
 * @public
 */
export interface RbacPolicyRule {
  readonly permission: string;
  readonly action: 'allow' | 'deny';
  readonly conditions?: RbacCondition[];
}

/**
 * An RBAC role that groups permission rules under a named identity.
 *
 * @public
 */
export interface RbacRole {
  readonly name: string;
  readonly description: string;
  readonly permissions: RbacPolicyRule[];
  readonly metadata?: Record<string, string>;
  /**
   * The id of the {@link RbacPolicyRecord} this role belongs to, if any.
   * Roles without a `policyId` are considered global and apply regardless
   * of which policy is currently published.
   */
  readonly policyId?: string;
}

/**
 * A subject (user or group) that can be bound to an RBAC role.
 *
 * @public
 */
export interface RbacSubject {
  readonly kind: 'user' | 'group';
  readonly name: string;
  readonly namespace?: string;
}

/**
 * A binding between an RBAC role and its subjects.
 *
 * @public
 */
export interface RbacRoleBinding {
  readonly role: string;
  readonly subjects: RbacSubject[];
}

/**
 * A complete RBAC policy comprising roles and their bindings.
 *
 * @public
 */
export interface RbacPolicy {
  readonly roles: RbacRole[];
  readonly bindings: RbacRoleBinding[];
}

/**
 * The result of evaluating an RBAC permission check.
 *
 * @public
 */
export interface RbacEvaluationResult {
  readonly allowed: boolean;
  readonly matchedRole?: string;
  readonly matchedRule?: RbacPolicyRule;
}

/**
 * The lifecycle status of an {@link RbacPolicyRecord}.
 *
 * - `draft`: editable, not active. Multiple drafts can exist at once.
 * - `published`: the single active policy version used for evaluation.
 * - `inactive`: archived, read-only, and eligible to be republished as a
 *   new draft.
 *
 * @public
 */
export type RbacPolicyStatus = 'draft' | 'published' | 'inactive';

/**
 * The strategy used to resolve a decision when multiple roles under a
 * policy match a permission request.
 *
 * - `first-match`: roles (and the policy's own rules) are evaluated in
 *   order, and the first rule that matches the requested permission wins.
 * - `any-allow`: all matching roles are scanned, and the request is
 *   allowed if any of them yields an explicit allow decision.
 *
 * @public
 */
export type RbacPolicyStrategy = 'first-match' | 'any-allow';

/**
 * A versioned RBAC policy, comprising its own rule set plus a lifecycle
 * status and resolution strategy. Roles may associate themselves with a
 * specific policy version via `policy_id`.
 *
 * @public
 */
export interface RbacPolicyRecord {
  readonly id: string;
  readonly name: string;
  readonly status: RbacPolicyStatus;
  readonly strategy: RbacPolicyStrategy;
  readonly rules: RbacPolicyRule[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt?: string;
}

/**
 * A conditional rule made available for use in {@link RbacCondition}s,
 * registered by a plugin for a given resource type.
 *
 * @public
 */
export interface RbacConditionalRuleRecord {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly resourceType: string;
  readonly paramsSchema?: Record<string, unknown>;
  readonly pluginId: string;
}
