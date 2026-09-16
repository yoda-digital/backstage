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
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import {
  AuthorizeResult,
  type PolicyDecision,
} from '@backstage/plugin-permission-common';
import type {
  PermissionPolicy,
  PolicyQuery,
  PolicyQueryUser,
} from '@backstage/plugin-permission-node';
import type { RbacPolicyRule } from '@backstage/plugin-rbac-common';
import { RbacPolicyClient } from './service/RbacPolicyClient';

class RbacHttpPermissionPolicy implements PermissionPolicy {
  constructor(
    private readonly client: RbacPolicyClient,
    private readonly admins: string[],
  ) {}

  async handle(
    request: PolicyQuery,
    user?: PolicyQueryUser,
  ): Promise<PolicyDecision> {
    const userRef = user?.info.userEntityRef;
    if (!userRef) {
      return { result: AuthorizeResult.DENY };
    }

    if (this.admins.includes(userRef)) {
      return { result: AuthorizeResult.ALLOW };
    }

    const ownershipRefs = user?.info.ownershipEntityRefs ?? [];
    const subjectRefs = parseEntityRefs([userRef, ...ownershipRefs]);

    const [roles, allBindings] = await Promise.all([
      this.client.listRoles(),
      this.client.listBindings(),
    ]);

    const matchedRoleNames = new Set<string>();
    for (const ref of subjectRefs) {
      for (const binding of allBindings) {
        for (const subject of binding.subjects) {
          if (
            subject.kind === ref.kind &&
            subject.name === ref.name &&
            (subject.namespace ?? 'default') === (ref.namespace ?? 'default')
          ) {
            matchedRoleNames.add(binding.role);
          }
        }
      }
    }

    const matchedRoles = roles.filter(r => matchedRoleNames.has(r.name));
    for (const role of matchedRoles) {
      for (const rule of role.permissions) {
        if (matchesPermission(rule, request)) {
          return rule.action === 'allow'
            ? { result: AuthorizeResult.ALLOW }
            : { result: AuthorizeResult.DENY };
        }
      }
    }

    return { result: AuthorizeResult.DENY };
  }
}

function matchesPermission(
  rule: RbacPolicyRule,
  request: PolicyQuery,
): boolean {
  if (rule.permission === '*') {
    return true;
  }
  return request.permission.name === rule.permission;
}

function parseEntityRefs(
  refs: string[],
): Array<{ kind: string; name: string; namespace?: string }> {
  return refs.map(ref => {
    const colonIndex = ref.indexOf(':');
    const kind = colonIndex >= 0 ? ref.substring(0, colonIndex) : 'user';
    const rest = colonIndex >= 0 ? ref.substring(colonIndex + 1) : ref;
    const slashIndex = rest.indexOf('/');
    const namespace =
      slashIndex >= 0 ? rest.substring(0, slashIndex) : 'default';
    const name = slashIndex >= 0 ? rest.substring(slashIndex + 1) : rest;
    return { kind, name, namespace };
  });
}

/**
 * A permission backend module that uses the RBAC plugin to evaluate
 * permission policies. This replaces the allow-all policy module.
 *
 * @public
 */
export const permissionModuleRbacPolicy = createBackendModule({
  pluginId: 'permission',
  moduleId: 'rbac-policy',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        policy: policyExtensionPoint,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
      },
      async init({ config, policy, discovery, auth }) {
        const admins = config.getOptionalStringArray('rbac.admins') ?? [];
        const client = RbacPolicyClient.create({ discovery, auth });
        policy.setPolicy(new RbacHttpPermissionPolicy(client, admins));
      },
    });
  },
});
