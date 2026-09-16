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
  AuthorizeResult,
  isResourcePermission,
  PermissionCondition,
  PermissionCriteria,
  PermissionRuleParams,
  PolicyDecision,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
  PolicyQueryUser,
} from '@backstage/plugin-permission-node';
import type {
  RbacCondition,
  RbacPolicyRecord,
  RbacPolicyRule,
  RbacRole,
} from '@backstage/plugin-rbac-common';
import type { RbacStore } from '../database/RbacStore';

/**
 * A named group of ordered rules considered during resolution: either the
 * active policy's own rules, or the permissions of a role bound to the
 * requesting subject.
 */
interface RuleSource {
  readonly name: string;
  readonly rules: RbacPolicyRule[];
}

/** @internal */
export class RbacPermissionPolicy implements PermissionPolicy {
  private constructor(
    private readonly store: RbacStore,
    private readonly admins: string[],
  ) {}

  static create(options: {
    store: RbacStore;
    admins: string[];
  }): RbacPermissionPolicy {
    return new RbacPermissionPolicy(options.store, options.admins);
  }

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
    const claims = [userRef, ...ownershipRefs];

    const activePolicy = await this.store.getActivePolicy();
    const sources = await this.collectRuleSources(activePolicy, claims);

    return activePolicy?.strategy === 'any-allow'
      ? this.resolveAnyAllow(sources, request, claims)
      : this.resolveFirstMatch(sources, request, claims);
  }

  /**
   * Gathers the ordered rule sources that apply to the given subject: the
   * active policy's own rules first (if any), followed by the bound roles
   * (sorted by name for determinism) that are visible under that policy.
   *
   * When no policy has been published yet, all bound roles are considered,
   * preserving the pre-policy-lifecycle behavior.
   */
  private async collectRuleSources(
    activePolicy: RbacPolicyRecord | undefined,
    claims: string[],
  ): Promise<RuleSource[]> {
    const sources: RuleSource[] = [];
    if (activePolicy && activePolicy.rules.length > 0) {
      sources.push({
        name: `policy:${activePolicy.name}`,
        rules: activePolicy.rules,
      });
    }

    const subjectRefs = this.parseEntityRefs(claims);
    const roleNames = new Set<string>();
    for (const ref of subjectRefs) {
      const roles = await this.store.getRolesForSubject(
        ref.kind,
        ref.name,
        ref.namespace,
      );
      for (const role of roles) {
        roleNames.add(role);
      }
    }

    const roles = activePolicy
      ? await this.store.listRolesForPolicy(
          Array.from(roleNames),
          activePolicy.id,
        )
      : await this.getRolesByName(Array.from(roleNames));

    for (const role of [...roles].sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      sources.push({ name: `role:${role.name}`, rules: role.permissions });
    }

    return sources;
  }

  private async getRolesByName(names: string[]): Promise<RbacRole[]> {
    const roles: RbacRole[] = [];
    for (const name of names) {
      const role = await this.store.getRole(name);
      if (role) {
        roles.push(role);
      }
    }
    return roles;
  }

  /**
   * First-Match strategy (the default): sources are evaluated in order, and
   * the first rule matching the requested permission wins.
   */
  private resolveFirstMatch(
    sources: RuleSource[],
    request: PolicyQuery,
    claims: string[],
  ): PolicyDecision {
    for (const source of sources) {
      for (const rule of source.rules) {
        if (!this.matchesPermission(rule, request)) {
          continue;
        }
        const decision = this.ruleToDecision(rule, request, claims);
        if (decision) {
          return decision;
        }
      }
    }
    return { result: AuthorizeResult.DENY };
  }

  /**
   * Any-Allow strategy: every matching rule across every source is
   * considered. The request is allowed if any of them yields an explicit
   * (possibly conditional) allow; otherwise it is denied.
   */
  private resolveAnyAllow(
    sources: RuleSource[],
    request: PolicyQuery,
    claims: string[],
  ): PolicyDecision {
    const conditionalAllows: PermissionCriteria<PermissionCondition>[] = [];

    for (const source of sources) {
      for (const rule of source.rules) {
        if (rule.action !== 'allow' || !this.matchesPermission(rule, request)) {
          continue;
        }
        if (!rule.conditions?.length) {
          return { result: AuthorizeResult.ALLOW };
        }
        const criteria = this.buildCriteria(rule.conditions, request, claims);
        if (criteria) {
          conditionalAllows.push(criteria);
        }
      }
    }

    if (conditionalAllows.length === 0) {
      return { result: AuthorizeResult.DENY };
    }
    const [first, ...rest] = conditionalAllows;
    return this.conditionalDecision(
      request,
      rest.length === 0 ? first : { anyOf: [first, ...rest] },
    );
  }

  /**
   * Converts a single matched rule into a decision. Returns `undefined`
   * when the rule has conditions that cannot be evaluated for this request
   * (i.e. the permission is not a resource permission), so the caller can
   * continue scanning subsequent rules.
   */
  private ruleToDecision(
    rule: RbacPolicyRule,
    request: PolicyQuery,
    claims: string[],
  ): PolicyDecision | undefined {
    if (!rule.conditions?.length) {
      return {
        result:
          rule.action === 'allow'
            ? AuthorizeResult.ALLOW
            : AuthorizeResult.DENY,
      };
    }

    const criteria = this.buildCriteria(rule.conditions, request, claims);
    if (!criteria) {
      return undefined;
    }

    if (rule.action === 'allow') {
      return this.conditionalDecision(request, criteria);
    }

    // The permission framework only expresses conditional *allows*, so a
    // conditional deny is modeled as "allow unless the condition holds".
    return this.conditionalDecision(request, { not: criteria });
  }

  private buildCriteria(
    conditions: RbacCondition[],
    request: PolicyQuery,
    claims: string[],
  ): PermissionCriteria<PermissionCondition> | undefined {
    if (!isResourcePermission(request.permission)) {
      return undefined;
    }
    const resourceType = request.permission.resourceType;

    const built: PermissionCondition[] = conditions.map(condition => ({
      resourceType,
      rule: condition.rule,
      // IS_ENTITY_OWNER depends on the caller's identity, which is runtime
      // context rather than static role configuration, so it is injected
      // here rather than declared by the role author.
      params: (condition.rule === 'IS_ENTITY_OWNER'
        ? { ...condition.params, claims }
        : condition.params) as PermissionRuleParams,
    }));

    const [first, ...rest] = built;
    return rest.length === 0 ? first : { allOf: [first, ...rest] };
  }

  private conditionalDecision(
    request: PolicyQuery,
    conditions: PermissionCriteria<PermissionCondition>,
  ): PolicyDecision {
    return {
      result: AuthorizeResult.CONDITIONAL,
      pluginId: 'rbac',
      resourceType: isResourcePermission(request.permission)
        ? request.permission.resourceType
        : '',
      conditions,
    };
  }

  private matchesPermission(
    rule: RbacPolicyRule,
    request: PolicyQuery,
  ): boolean {
    if (rule.permission === '*') {
      return true;
    }
    return request.permission.name === rule.permission;
  }

  private parseEntityRefs(
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
}
