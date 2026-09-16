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

import { AuthorizeResult } from '@backstage/plugin-permission-common';
import type { PolicyQueryUser } from '@backstage/plugin-permission-node';
import type { RbacPolicyRecord, RbacRole } from '@backstage/plugin-rbac-common';
import { mockCredentials } from '@backstage/backend-test-utils';
import { RbacPermissionPolicy } from './policy';
import type { RbacStore } from '../database/RbacStore';

const basicPermission = (name: string) => ({
  type: 'basic' as const,
  name,
  attributes: {},
});

const resourcePermission = (name: string, resourceType: string) => ({
  type: 'resource' as const,
  name,
  resourceType,
  attributes: {},
});

function fakeStore(options: {
  activePolicy?: RbacPolicyRecord;
  roleNames?: string[];
  roles?: RbacRole[];
}): RbacStore {
  const roles = options.roles ?? [];
  return {
    getActivePolicy: async () => options.activePolicy,
    getRolesForSubject: async () => options.roleNames ?? [],
    listRolesForPolicy: async (names: string[], policyId: string) =>
      roles.filter(
        role =>
          names.includes(role.name) &&
          (!role.policyId || role.policyId === policyId),
      ),
    getRole: async (name: string) => roles.find(role => role.name === name),
  } as unknown as RbacStore;
}

function user(userRef: string, ownershipEntityRefs: string[] = []) {
  return {
    credentials: mockCredentials.user(userRef),
    info: { userEntityRef: userRef, ownershipEntityRefs },
  } as PolicyQueryUser;
}

describe('RbacPermissionPolicy', () => {
  it('denies when there is no user', async () => {
    const policy = RbacPermissionPolicy.create({
      store: fakeStore({}),
      admins: [],
    });
    const decision = await policy.handle({
      permission: basicPermission('catalog.entity.read'),
    });
    expect(decision).toEqual({ result: AuthorizeResult.DENY });
  });

  it('allows admins unconditionally', async () => {
    const policy = RbacPermissionPolicy.create({
      store: fakeStore({}),
      admins: ['user:default/admin'],
    });
    const decision = await policy.handle(
      { permission: basicPermission('catalog.entity.delete') },
      user('user:default/admin'),
    );
    expect(decision).toEqual({ result: AuthorizeResult.ALLOW });
  });

  it('falls back to legacy role evaluation when no policy is published', async () => {
    const store = fakeStore({
      roleNames: ['viewer'],
      roles: [
        {
          name: 'viewer',
          description: '',
          permissions: [{ permission: 'catalog.entity.read', action: 'allow' }],
        },
      ],
    });
    const policy = RbacPermissionPolicy.create({ store, admins: [] });

    const decision = await policy.handle(
      { permission: basicPermission('catalog.entity.read') },
      user('user:default/alice'),
    );
    expect(decision).toEqual({ result: AuthorizeResult.ALLOW });

    const denied = await policy.handle(
      { permission: basicPermission('catalog.entity.delete') },
      user('user:default/alice'),
    );
    expect(denied).toEqual({ result: AuthorizeResult.DENY });
  });

  it('applies first-match strategy across policy rules and roles in order', async () => {
    const activePolicy: RbacPolicyRecord = {
      id: 'policy-1',
      name: 'main',
      status: 'published',
      strategy: 'first-match',
      rules: [{ permission: 'catalog.entity.read', action: 'deny' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    };
    const store = fakeStore({
      activePolicy,
      roleNames: ['viewer'],
      roles: [
        {
          name: 'viewer',
          description: '',
          policyId: 'policy-1',
          permissions: [{ permission: 'catalog.entity.read', action: 'allow' }],
        },
      ],
    });
    const policy = RbacPermissionPolicy.create({ store, admins: [] });

    // The policy-level rule is evaluated first and matches, so it wins over
    // the role's allow rule.
    const decision = await policy.handle(
      { permission: basicPermission('catalog.entity.read') },
      user('user:default/alice'),
    );
    expect(decision).toEqual({ result: AuthorizeResult.DENY });
  });

  it('excludes roles scoped to a different policy', async () => {
    const activePolicy: RbacPolicyRecord = {
      id: 'policy-1',
      name: 'main',
      status: 'published',
      strategy: 'first-match',
      rules: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const store = fakeStore({
      activePolicy,
      roleNames: ['stale-viewer'],
      roles: [
        {
          name: 'stale-viewer',
          description: '',
          policyId: 'some-other-policy',
          permissions: [{ permission: 'catalog.entity.read', action: 'allow' }],
        },
      ],
    });
    const policy = RbacPermissionPolicy.create({ store, admins: [] });

    const decision = await policy.handle(
      { permission: basicPermission('catalog.entity.read') },
      user('user:default/alice'),
    );
    expect(decision).toEqual({ result: AuthorizeResult.DENY });
  });

  it('applies any-allow strategy by scanning every matching role', async () => {
    const activePolicy: RbacPolicyRecord = {
      id: 'policy-2',
      name: 'any-allow-policy',
      status: 'published',
      strategy: 'any-allow',
      rules: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const store = fakeStore({
      activePolicy,
      roleNames: ['denier', 'allower'],
      roles: [
        {
          name: 'allower',
          description: '',
          policyId: 'policy-2',
          permissions: [{ permission: 'catalog.entity.read', action: 'allow' }],
        },
        {
          name: 'denier',
          description: '',
          policyId: 'policy-2',
          permissions: [{ permission: 'catalog.entity.read', action: 'deny' }],
        },
      ],
    });
    const policy = RbacPermissionPolicy.create({ store, admins: [] });

    const decision = await policy.handle(
      { permission: basicPermission('catalog.entity.read') },
      user('user:default/alice'),
    );
    // any-allow: since at least one role explicitly allows, the request is
    // allowed regardless of the other role's deny.
    expect(decision).toEqual({ result: AuthorizeResult.ALLOW });
  });

  it('returns a CONDITIONAL decision for a rule with conditions on a resource permission', async () => {
    const store = fakeStore({
      roleNames: ['owner-viewer'],
      roles: [
        {
          name: 'owner-viewer',
          description: '',
          permissions: [
            {
              permission: 'catalog.entity.read',
              action: 'allow',
              conditions: [{ rule: 'IS_ENTITY_OWNER', params: {} }],
            },
          ],
        },
      ],
    });
    const policy = RbacPermissionPolicy.create({ store, admins: [] });

    const decision = await policy.handle(
      {
        permission: resourcePermission('catalog.entity.read', 'catalog-entity'),
      },
      user('user:default/alice', ['group:default/team-a']),
    );

    expect(decision).toEqual({
      result: AuthorizeResult.CONDITIONAL,
      pluginId: 'rbac',
      resourceType: 'catalog-entity',
      conditions: {
        resourceType: 'catalog-entity',
        rule: 'IS_ENTITY_OWNER',
        params: {
          claims: ['user:default/alice', 'group:default/team-a'],
        },
      },
    });
  });

  it('inverts a conditional deny rule with a not-criteria', async () => {
    const store = fakeStore({
      roleNames: ['restricted'],
      roles: [
        {
          name: 'restricted',
          description: '',
          permissions: [
            {
              permission: 'catalog.entity.delete',
              action: 'deny',
              conditions: [{ rule: 'HAS_TAG', params: { tag: 'locked' } }],
            },
          ],
        },
      ],
    });
    const policy = RbacPermissionPolicy.create({ store, admins: [] });

    const decision = await policy.handle(
      {
        permission: resourcePermission(
          'catalog.entity.delete',
          'catalog-entity',
        ),
      },
      user('user:default/alice'),
    );

    expect(decision).toEqual({
      result: AuthorizeResult.CONDITIONAL,
      pluginId: 'rbac',
      resourceType: 'catalog-entity',
      conditions: {
        not: {
          resourceType: 'catalog-entity',
          rule: 'HAS_TAG',
          params: { tag: 'locked' },
        },
      },
    });
  });

  it('skips a conditional rule when the permission is not a resource permission', async () => {
    const store = fakeStore({
      roleNames: ['role-a'],
      roles: [
        {
          name: 'role-a',
          description: '',
          permissions: [
            {
              permission: 'catalog.entity.read',
              action: 'allow',
              conditions: [{ rule: 'HAS_TAG', params: { tag: 'x' } }],
            },
          ],
        },
      ],
    });
    const policy = RbacPermissionPolicy.create({ store, admins: [] });

    const decision = await policy.handle(
      { permission: basicPermission('catalog.entity.read') },
      user('user:default/alice'),
    );
    // The conditional rule cannot be evaluated for a basic permission, and
    // there is nothing else to match, so the request is denied by default.
    expect(decision).toEqual({ result: AuthorizeResult.DENY });
  });
});
