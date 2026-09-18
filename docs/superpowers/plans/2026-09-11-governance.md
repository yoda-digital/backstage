# Sub-project 2: Governance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build RBAC policy engine, entity overlay system, and audit logging — the governance layer that all subsequent sub-projects depend on.

**Architecture:** RBAC replaces the allow-all policy with a role-based permission system. Entity Overlays add a merge-on-read catalog processor for user-managed metadata. Audit Log captures all state mutations via the existing `coreServices.auditor` infrastructure. All three share RBAC permission definitions.

**Tech Stack:** PostgreSQL (Knex), Backstage Permission Framework, Catalog Processors, EventsService, new frontend system.

**Spec:** `docs/superpowers/specs/2026-09-11-devpane-portal-architecture-design.md` — Sub-project 2 section.

## Global Constraints

- New frontend system only — `createFrontendPlugin` from `@backstage/frontend-plugin-api`
- All backend plugins via `createBackendPlugin` from `@backstage/backend-plugin-api`
- Copyright headers: Apache 2.0, year 2026
- ADR011 naming: all packages prefixed `@backstage/plugin-`
- ADR004 exports: `index.ts` chains, named exports only
- No `React.FC`, no default exports (except `React.lazy`), `function` keyword for exported functions
- Config values via `config.d.ts` with `@visibility` annotations
- Tests: `startTestBackend`/`mockServices.*` for backend, `renderInTestApp`/`mockApis.*` for frontend
- Every write operation behind a permission check
- Every state mutation emits an audit event

---

### Task 1: RBAC Common — Types and Permission Definitions

**Files:**

- Create: `plugins/rbac-common/src/types.ts`
- Create: `plugins/rbac-common/src/permissions.ts`
- Create: `plugins/rbac-common/src/index.ts`
- Create: `plugins/rbac-common/package.json`

**Interfaces:**

- Consumes: `@backstage/plugin-permission-common` (Permission, ResourcePermission types)
- Produces: `RbacRole`, `RbacRoleBinding`, `RbacPolicyRule`, `rbacPermissions` object used by all governance plugins

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@backstage/plugin-rbac-common",
  "version": "0.1.0",
  "backstage": {
    "role": "common-library",
    "pluginId": "rbac",
    "pluginPackages": [
      "@backstage/plugin-rbac",
      "@backstage/plugin-rbac-backend",
      "@backstage/plugin-rbac-common",
      "@backstage/plugin-rbac-node"
    ]
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@backstage/plugin-permission-common": "workspace:^"
  }
}
```

- [ ] **Step 2: Create types.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

export interface RbacRole {
  readonly name: string;
  readonly description: string;
  readonly permissions: RbacPolicyRule[];
  readonly metadata?: Record<string, string>;
}

export interface RbacRoleBinding {
  readonly role: string;
  readonly subjects: RbacSubject[];
}

export interface RbacSubject {
  readonly kind: 'user' | 'group';
  readonly name: string;
  readonly namespace?: string;
}

export interface RbacPolicyRule {
  readonly permission: string;
  readonly action: 'allow' | 'deny';
  readonly conditions?: RbacCondition[];
}

export interface RbacCondition {
  readonly rule: string;
  readonly params: Record<string, unknown>;
}

export interface RbacPolicy {
  readonly roles: RbacRole[];
  readonly bindings: RbacRoleBinding[];
}

export interface RbacEvaluationResult {
  readonly allowed: boolean;
  readonly matchedRole?: string;
  readonly matchedRule?: RbacPolicyRule;
}
```

- [ ] **Step 3: Create permissions.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import {
  createPermission,
  ResourcePermission,
} from '@backstage/plugin-permission-common';

export const RBAC_RESOURCE_TYPE = 'rbac-role';

export const rbacRoleCreatePermission = createPermission({
  name: 'rbac.role.create',
  attributes: { action: 'create' },
});

export const rbacRoleReadPermission = createPermission({
  name: 'rbac.role.read',
  attributes: { action: 'read' },
});

export const rbacRoleUpdatePermission = createPermission({
  name: 'rbac.role.update',
  attributes: { action: 'update' },
});

export const rbacRoleDeletePermission = createPermission({
  name: 'rbac.role.delete',
  attributes: { action: 'delete' },
});

export const rbacPermissions = [
  rbacRoleCreatePermission,
  rbacRoleReadPermission,
  rbacRoleUpdatePermission,
  rbacRoleDeletePermission,
];
```

- [ ] **Step 4: Create index.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

/**
 * Common types and permissions for the RBAC plugin.
 * @packageDocumentation
 */

export {
  RbacRole,
  RbacRoleBinding,
  RbacSubject,
  RbacPolicyRule,
  RbacCondition,
  RbacPolicy,
  RbacEvaluationResult,
} from './types';

export {
  RBAC_RESOURCE_TYPE,
  rbacRoleCreatePermission,
  rbacRoleReadPermission,
  rbacRoleUpdatePermission,
  rbacRoleDeletePermission,
  rbacPermissions,
} from './permissions';
```

- [ ] **Step 5: Commit**

```bash
git add plugins/rbac-common/
git commit -s -m "feat(rbac): add rbac-common package with types and permissions"
```

---

### Task 2: RBAC Node — Extension Point for Policy Providers

**Files:**

- Create: `plugins/rbac-node/src/extensions.ts`
- Create: `plugins/rbac-node/src/index.ts`
- Create: `plugins/rbac-node/package.json`

**Interfaces:**

- Consumes: `@backstage/backend-plugin-api` (createExtensionPoint)
- Produces: `rbacPolicyProviderExtensionPoint` — modules register custom policy sources

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@backstage/plugin-rbac-node",
  "version": "0.1.0",
  "backstage": {
    "role": "node-library",
    "pluginId": "rbac",
    "pluginPackages": [
      "@backstage/plugin-rbac",
      "@backstage/plugin-rbac-backend",
      "@backstage/plugin-rbac-common",
      "@backstage/plugin-rbac-node"
    ]
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@backstage/backend-plugin-api": "workspace:^",
    "@backstage/plugin-rbac-common": "workspace:^"
  }
}
```

- [ ] **Step 2: Create extensions.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { createExtensionPoint } from '@backstage/backend-plugin-api';
import { RbacPolicy } from '@backstage/plugin-rbac-common';

export interface RbacPolicyProvider {
  readonly providerId: string;
  loadPolicies(): Promise<RbacPolicy>;
  onChange?(callback: () => void): void;
}

export interface RbacPolicyProviderExtensionPoint {
  addProvider(provider: RbacPolicyProvider): void;
}

export const rbacPolicyProviderExtensionPoint =
  createExtensionPoint<RbacPolicyProviderExtensionPoint>({
    id: 'rbac.policy-provider',
  });
```

- [ ] **Step 3: Create index.ts re-exporting everything**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

/**
 * Node.js library for the RBAC plugin.
 * @packageDocumentation
 */

export {
  RbacPolicyProvider,
  RbacPolicyProviderExtensionPoint,
  rbacPolicyProviderExtensionPoint,
} from './extensions';
```

- [ ] **Step 4: Commit**

```bash
git add plugins/rbac-node/
git commit -s -m "feat(rbac): add rbac-node package with policy provider extension point"
```

---

### Task 3: RBAC Backend — Policy Engine, REST API, Database

**Files:**

- Create: `plugins/rbac-backend/src/plugin.ts`
- Create: `plugins/rbac-backend/src/service/router.ts`
- Create: `plugins/rbac-backend/src/service/policy.ts`
- Create: `plugins/rbac-backend/src/database/RbacStore.ts`
- Create: `plugins/rbac-backend/src/database/migrations.ts`
- Create: `plugins/rbac-backend/src/index.ts`
- Create: `plugins/rbac-backend/src/tests/plugin.test.ts`
- Create: `plugins/rbac-backend/config.d.ts`
- Create: `plugins/rbac-backend/package.json`

**Interfaces:**

- Consumes: `rbacPolicyProviderExtensionPoint` from rbac-node, `coreServices.*`, `@backstage/plugin-permission-node`
- Produces: REST API (`/api/rbac/roles`, `/api/rbac/bindings`, `/api/rbac/evaluate`), `PermissionPolicy` implementation

- [ ] **Step 1: Create package.json**

Standard backend-plugin package.json with dependencies on `@backstage/backend-plugin-api`, `@backstage/plugin-permission-node`, `@backstage/plugin-rbac-common`, `@backstage/plugin-rbac-node`, `express`, `knex`, `@backstage/backend-defaults`.

- [ ] **Step 2: Create config.d.ts**

```ts
export interface Config {
  /**
   * RBAC plugin configuration
   */
  rbac?: {
    /**
     * Path to YAML file with role/binding definitions
     * @visibility backend
     */
    policyFile?: string;
    /**
     * Admin users who bypass RBAC checks
     * @visibility backend
     */
    admins?: string[];
  };
}
```

- [ ] **Step 3: Create database migration**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('rbac_roles', table => {
    table.string('name').primary().notNullable();
    table.string('description').notNullable().defaultTo('');
    table.jsonb('permissions').notNullable().defaultTo('[]');
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('rbac_bindings', table => {
    table.string('id').primary().notNullable();
    table
      .string('role')
      .notNullable()
      .references('name')
      .inTable('rbac_roles')
      .onDelete('CASCADE');
    table.string('subject_kind').notNullable();
    table.string('subject_name').notNullable();
    table.string('subject_namespace').defaultTo('default');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['role', 'subject_kind', 'subject_name', 'subject_namespace']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('rbac_bindings');
  await knex.schema.dropTableIfExists('rbac_roles');
}
```

- [ ] **Step 4: Create RbacStore**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { Knex } from 'knex';
import {
  RbacRole,
  RbacRoleBinding,
  RbacSubject,
  RbacPolicyRule,
} from '@backstage/plugin-rbac-common';

export class RbacStore {
  private constructor(private readonly db: Knex) {}

  static async create(options: { database: Knex }): Promise<RbacStore> {
    await options.database.migrate.latest({
      directory: __dirname + '/migrations',
    });
    return new RbacStore(options.database);
  }

  async listRoles(): Promise<RbacRole[]> {
    const rows = await this.db('rbac_roles').select('*');
    return rows.map(row => ({
      name: row.name,
      description: row.description,
      permissions: JSON.parse(row.permissions),
      metadata: JSON.parse(row.metadata),
    }));
  }

  async getRole(name: string): Promise<RbacRole | undefined> {
    const row = await this.db('rbac_roles').where({ name }).first();
    if (!row) return undefined;
    return {
      name: row.name,
      description: row.description,
      permissions: JSON.parse(row.permissions),
      metadata: JSON.parse(row.metadata),
    };
  }

  async createRole(role: RbacRole): Promise<void> {
    await this.db('rbac_roles').insert({
      name: role.name,
      description: role.description,
      permissions: JSON.stringify(role.permissions),
      metadata: JSON.stringify(role.metadata ?? {}),
    });
  }

  async updateRole(name: string, role: Partial<RbacRole>): Promise<void> {
    const update: Record<string, unknown> = { updated_at: this.db.fn.now() };
    if (role.description !== undefined) update.description = role.description;
    if (role.permissions !== undefined)
      update.permissions = JSON.stringify(role.permissions);
    if (role.metadata !== undefined)
      update.metadata = JSON.stringify(role.metadata);
    await this.db('rbac_roles').where({ name }).update(update);
  }

  async deleteRole(name: string): Promise<void> {
    await this.db('rbac_roles').where({ name }).delete();
  }

  async listBindings(role?: string): Promise<RbacRoleBinding[]> {
    let query = this.db('rbac_bindings').select('*');
    if (role) query = query.where({ role });
    const rows = await query;

    const grouped = new Map<string, RbacSubject[]>();
    for (const row of rows) {
      const subjects = grouped.get(row.role) ?? [];
      subjects.push({
        kind: row.subject_kind,
        name: row.subject_name,
        namespace: row.subject_namespace,
      });
      grouped.set(row.role, subjects);
    }

    return Array.from(grouped.entries()).map(([roleName, subjects]) => ({
      role: roleName,
      subjects,
    }));
  }

  async addBinding(role: string, subject: RbacSubject): Promise<void> {
    const id = `${role}:${subject.kind}:${subject.namespace ?? 'default'}/${
      subject.name
    }`;
    await this.db('rbac_bindings')
      .insert({
        id,
        role,
        subject_kind: subject.kind,
        subject_name: subject.name,
        subject_namespace: subject.namespace ?? 'default',
      })
      .onConflict('id')
      .ignore();
  }

  async removeBinding(role: string, subject: RbacSubject): Promise<void> {
    await this.db('rbac_bindings')
      .where({
        role,
        subject_kind: subject.kind,
        subject_name: subject.name,
        subject_namespace: subject.namespace ?? 'default',
      })
      .delete();
  }

  async getRolesForSubject(
    kind: string,
    name: string,
    namespace?: string,
  ): Promise<string[]> {
    const rows = await this.db('rbac_bindings')
      .where({
        subject_kind: kind,
        subject_name: name,
        subject_namespace: namespace ?? 'default',
      })
      .select('role');
    return rows.map(r => r.role);
  }
}
```

- [ ] **Step 5: Create policy.ts — PermissionPolicy implementation**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import {
  PolicyDecision,
  AuthorizeResult,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
} from '@backstage/plugin-permission-node';
import { BackstageIdentityResponse } from '@backstage/plugin-auth-node';
import { RbacStore } from '../database/RbacStore';
import { RbacPolicyRule } from '@backstage/plugin-rbac-common';

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
    user?: BackstageIdentityResponse,
  ): Promise<PolicyDecision> {
    const userRef = user?.identity?.userEntityRef;
    if (!userRef) {
      return { result: AuthorizeResult.DENY };
    }

    if (this.admins.includes(userRef)) {
      return { result: AuthorizeResult.ALLOW };
    }

    const ownership = user?.identity?.ownershipEntityRefs ?? [];
    const allRoles: string[] = [];

    for (const ref of [userRef, ...ownership]) {
      const parts = ref.split(':');
      const kind = parts[0] ?? 'user';
      const rest = parts.slice(1).join(':');
      const [namespace, name] = rest.includes('/')
        ? rest.split('/')
        : ['default', rest];
      const roles = await this.store.getRolesForSubject(kind, name, namespace);
      allRoles.push(...roles);
    }

    const uniqueRoles = [...new Set(allRoles)];

    for (const roleName of uniqueRoles) {
      const role = await this.store.getRole(roleName);
      if (!role) continue;

      for (const rule of role.permissions) {
        if (this.matchesPermission(rule, request)) {
          return rule.action === 'allow'
            ? { result: AuthorizeResult.ALLOW }
            : { result: AuthorizeResult.DENY };
        }
      }
    }

    return { result: AuthorizeResult.DENY };
  }

  private matchesPermission(
    rule: RbacPolicyRule,
    request: PolicyQuery,
  ): boolean {
    if (rule.permission === '*') return true;
    return request.permission.name === rule.permission;
  }
}
```

- [ ] **Step 6: Create router.ts — REST API**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { Router } from 'express';
import { RbacStore } from '../database/RbacStore';
import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';
import { InputError, NotFoundError } from '@backstage/errors';
import { Config } from '@backstage/config';

export interface RouterOptions {
  store: RbacStore;
  httpAuth: HttpAuthService;
  logger: LoggerService;
  config: Config;
}

export function createRouter(options: RouterOptions): Router {
  const { store, httpAuth, logger } = options;
  const router = Router();

  router.get('/roles', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const roles = await store.listRoles();
    res.json(roles);
  });

  router.get('/roles/:name', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const role = await store.getRole(req.params.name);
    if (!role) throw new NotFoundError(`Role ${req.params.name} not found`);
    res.json(role);
  });

  router.post('/roles', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const { name, description, permissions } = req.body;
    if (!name) throw new InputError('name is required');
    await store.createRole({
      name,
      description: description ?? '',
      permissions: permissions ?? [],
      metadata: {},
    });
    logger.info(`Created role ${name}`);
    res.status(201).json({ name });
  });

  router.put('/roles/:name', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const existing = await store.getRole(req.params.name);
    if (!existing) throw new NotFoundError(`Role ${req.params.name} not found`);
    await store.updateRole(req.params.name, req.body);
    res.status(200).json({ updated: true });
  });

  router.delete('/roles/:name', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    await store.deleteRole(req.params.name);
    res.status(204).end();
  });

  router.get('/bindings', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const role = req.query.role as string | undefined;
    const bindings = await store.listBindings(role);
    res.json(bindings);
  });

  router.post('/bindings', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const { role, subject } = req.body;
    if (!role || !subject)
      throw new InputError('role and subject are required');
    await store.addBinding(role, subject);
    res.status(201).json({ created: true });
  });

  router.delete('/bindings', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const { role, subject } = req.body;
    if (!role || !subject)
      throw new InputError('role and subject are required');
    await store.removeBinding(role, subject);
    res.status(204).end();
  });

  const middleware = MiddlewareFactory.create({
    config: options.config,
    logger,
  });
  router.use(middleware.error());
  return router;
}
```

- [ ] **Step 7: Create plugin.ts — backend plugin wiring**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { rbacPolicyProviderExtensionPoint } from '@backstage/plugin-rbac-node';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { RbacStore } from './database/RbacStore';
import { RbacPermissionPolicy } from './service/policy';
import { createRouter } from './service/router';

export const rbacPlugin = createBackendPlugin({
  pluginId: 'rbac',
  register(env) {
    const providers: Array<
      import('@backstage/plugin-rbac-node').RbacPolicyProvider
    > = [];

    env.registerExtensionPoint(rbacPolicyProviderExtensionPoint, {
      addProvider(provider) {
        providers.push(provider);
      },
    });

    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        permissions: policyExtensionPoint,
      },
      async init({
        config,
        logger,
        database,
        httpAuth,
        httpRouter,
        permissions,
      }) {
        const knex = await database.getClient();
        const store = await RbacStore.create({ database: knex });

        const admins = config.getOptionalStringArray('rbac.admins') ?? [];
        const policy = RbacPermissionPolicy.create({ store, admins });
        permissions.setPolicy(policy);

        const router = createRouter({ store, httpAuth, logger, config });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/',
          allow: 'user-cookie',
        });

        logger.info('RBAC plugin initialized');
      },
    });
  },
});
```

- [ ] **Step 8: Create index.ts**

```ts
export { rbacPlugin as default } from './plugin';
```

- [ ] **Step 9: Write integration test**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { startTestBackend } from '@backstage/backend-test-utils';
import { mockServices } from '@backstage/backend-test-utils';
import request from 'supertest';

describe('rbac-backend', () => {
  it('should create and retrieve a role', async () => {
    const { server } = await startTestBackend({
      features: [
        import('../src/index'),
        mockServices.rootConfig.factory({
          data: { rbac: { admins: ['user:default/admin'] } },
        }),
      ],
    });

    const createRes = await request(server)
      .post('/api/rbac/roles')
      .send({
        name: 'viewer',
        description: 'Read-only access',
        permissions: [{ permission: 'catalog.entity.read', action: 'allow' }],
      });
    expect(createRes.status).toBe(201);

    const getRes = await request(server).get('/api/rbac/roles/viewer');
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe('viewer');
    expect(getRes.body.permissions).toHaveLength(1);
  });

  it('should manage role bindings', async () => {
    const { server } = await startTestBackend({
      features: [
        import('../src/index'),
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    await request(server)
      .post('/api/rbac/roles')
      .send({ name: 'editor', description: 'Edit access', permissions: [] });

    const bindRes = await request(server)
      .post('/api/rbac/bindings')
      .send({ role: 'editor', subject: { kind: 'user', name: 'alice' } });
    expect(bindRes.status).toBe(201);

    const listRes = await request(server).get('/api/rbac/bindings?role=editor');
    expect(listRes.status).toBe(200);
    expect(listRes.body[0].subjects).toHaveLength(1);
  });
});
```

- [ ] **Step 10: Run tests**

Run: `CI=1 yarn test plugins/rbac-backend`
Expected: All tests pass

- [ ] **Step 11: Commit**

```bash
git add plugins/rbac-backend/
git commit -s -m "feat(rbac): add rbac-backend with policy engine, REST API, and database"
```

---

### Task 4: RBAC Frontend — Policy Builder and Role Management UI

**Files:**

- Create: `plugins/rbac/src/alpha/plugin.tsx`
- Create: `plugins/rbac/src/components/RolesPage.tsx`
- Create: `plugins/rbac/src/components/RoleEditDialog.tsx`
- Create: `plugins/rbac/src/components/BindingsTable.tsx`
- Create: `plugins/rbac/src/api/RbacClient.ts`
- Create: `plugins/rbac/src/api/ref.ts`
- Create: `plugins/rbac/src/alpha/index.ts`
- Create: `plugins/rbac/src/index.ts`
- Create: `plugins/rbac/package.json`

**Interfaces:**

- Consumes: RBAC Backend REST API, `@backstage/core-plugin-api` (fetchApiRef, discoveryApiRef)
- Produces: RBAC management pages in the new frontend system

- [ ] **Step 1: Create api/ref.ts — API reference and client interface**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { createApiRef } from '@backstage/core-plugin-api';
import {
  RbacRole,
  RbacRoleBinding,
  RbacSubject,
} from '@backstage/plugin-rbac-common';

export interface RbacApi {
  listRoles(): Promise<RbacRole[]>;
  getRole(name: string): Promise<RbacRole>;
  createRole(role: Omit<RbacRole, 'metadata'>): Promise<void>;
  updateRole(name: string, role: Partial<RbacRole>): Promise<void>;
  deleteRole(name: string): Promise<void>;
  listBindings(role?: string): Promise<RbacRoleBinding[]>;
  addBinding(role: string, subject: RbacSubject): Promise<void>;
  removeBinding(role: string, subject: RbacSubject): Promise<void>;
}

export const rbacApiRef = createApiRef<RbacApi>({ id: 'plugin.rbac.api' });
```

- [ ] **Step 2: Create api/RbacClient.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import { RbacApi } from './ref';
import {
  RbacRole,
  RbacRoleBinding,
  RbacSubject,
} from '@backstage/plugin-rbac-common';

export class RbacClient implements RbacApi {
  private constructor(
    private readonly discoveryApi: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}

  static create(options: {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
  }): RbacClient {
    return new RbacClient(options.discoveryApi, options.fetchApi);
  }

  private async baseUrl(): Promise<string> {
    return `${await this.discoveryApi.getBaseUrl('rbac')}`;
  }

  async listRoles(): Promise<RbacRole[]> {
    const url = `${await this.baseUrl()}/roles`;
    const res = await this.fetchApi.fetch(url);
    if (!res.ok) throw await ResponseError.fromResponse(res);
    return res.json();
  }

  async getRole(name: string): Promise<RbacRole> {
    const url = `${await this.baseUrl()}/roles/${encodeURIComponent(name)}`;
    const res = await this.fetchApi.fetch(url);
    if (!res.ok) throw await ResponseError.fromResponse(res);
    return res.json();
  }

  async createRole(role: Omit<RbacRole, 'metadata'>): Promise<void> {
    const url = `${await this.baseUrl()}/roles`;
    const res = await this.fetchApi.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role),
    });
    if (!res.ok) throw await ResponseError.fromResponse(res);
  }

  async updateRole(name: string, role: Partial<RbacRole>): Promise<void> {
    const url = `${await this.baseUrl()}/roles/${encodeURIComponent(name)}`;
    const res = await this.fetchApi.fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role),
    });
    if (!res.ok) throw await ResponseError.fromResponse(res);
  }

  async deleteRole(name: string): Promise<void> {
    const url = `${await this.baseUrl()}/roles/${encodeURIComponent(name)}`;
    const res = await this.fetchApi.fetch(url, { method: 'DELETE' });
    if (!res.ok) throw await ResponseError.fromResponse(res);
  }

  async listBindings(role?: string): Promise<RbacRoleBinding[]> {
    const url = new URL(`${await this.baseUrl()}/bindings`);
    if (role) url.searchParams.set('role', role);
    const res = await this.fetchApi.fetch(url.toString());
    if (!res.ok) throw await ResponseError.fromResponse(res);
    return res.json();
  }

  async addBinding(role: string, subject: RbacSubject): Promise<void> {
    const url = `${await this.baseUrl()}/bindings`;
    const res = await this.fetchApi.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, subject }),
    });
    if (!res.ok) throw await ResponseError.fromResponse(res);
  }

  async removeBinding(role: string, subject: RbacSubject): Promise<void> {
    const url = `${await this.baseUrl()}/bindings`;
    const res = await this.fetchApi.fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, subject }),
    });
    if (!res.ok) throw await ResponseError.fromResponse(res);
  }
}
```

- [ ] **Step 3: Create components/RolesPage.tsx**

```tsx
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import React, { useState, useCallback } from 'react';
import {
  Table,
  TableColumn,
  Content,
  ContentHeader,
  Header,
  Page,
  SupportButton,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/esm/useAsync';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import { rbacApiRef } from '../api/ref';
import { RbacRole } from '@backstage/plugin-rbac-common';

export function RolesPage(): React.JSX.Element {
  const rbacApi = useApi(rbacApiRef);
  const [refresh, setRefresh] = useState(0);

  const {
    value: roles,
    loading,
    error,
  } = useAsync(() => rbacApi.listRoles(), [refresh]);

  const handleDelete = useCallback(
    async (name: string) => {
      await rbacApi.deleteRole(name);
      setRefresh(r => r + 1);
    },
    [rbacApi],
  );

  const columns: TableColumn<RbacRole>[] = [
    { title: 'Role', field: 'name' },
    { title: 'Description', field: 'description' },
    {
      title: 'Permissions',
      render: (row: RbacRole) => String(row.permissions.length),
    },
    {
      title: 'Actions',
      render: (row: RbacRole) => (
        <>
          <IconButton size="small" aria-label="edit">
            <EditIcon />
          </IconButton>
          <IconButton
            size="small"
            aria-label="delete"
            onClick={() => handleDelete(row.name)}
          >
            <DeleteIcon />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <Page themeId="tool">
      <Header title="RBAC Management" subtitle="Manage roles and permissions" />
      <Content>
        <ContentHeader title="Roles">
          <SupportButton>Manage RBAC roles and bindings</SupportButton>
        </ContentHeader>
        <Table
          title="Roles"
          columns={columns}
          data={roles ?? []}
          isLoading={loading}
          options={{ paging: true, pageSize: 20 }}
        />
      </Content>
    </Page>
  );
}
```

- [ ] **Step 4: Create alpha/plugin.tsx — new frontend system plugin**

```tsx
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import React from 'react';
import {
  createFrontendPlugin,
  PageBlueprint,
  ApiBlueprint,
} from '@backstage/frontend-plugin-api';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { rbacApiRef } from '../api/ref';
import { RbacClient } from '../api/RbacClient';

const rbacPage = PageBlueprint.make({
  params: {
    defaultPath: '/rbac',
    loader: () => import('../components/RolesPage').then(m => <m.RolesPage />),
  },
});

const rbacApi = ApiBlueprint.make({
  params: {
    factory: createApiFactory({
      api: rbacApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        RbacClient.create({ discoveryApi, fetchApi }),
    }),
  },
});

export default createFrontendPlugin({
  pluginId: 'rbac',
  extensions: [rbacPage, rbacApi],
});
```

- [ ] **Step 5: Create index.ts files and package.json**

- [ ] **Step 6: Commit**

```bash
git add plugins/rbac/
git commit -s -m "feat(rbac): add RBAC frontend plugin with role management UI"
```

---

### Task 5: Entity Overlays Common

**Files:**

- Create: `plugins/entity-overlays-common/src/types.ts`
- Create: `plugins/entity-overlays-common/src/index.ts`
- Create: `plugins/entity-overlays-common/package.json`

**Interfaces:**

- Consumes: nothing
- Produces: `EntityOverlay`, `OverlayPatch` types

- [ ] **Step 1: Create types.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

export interface EntityOverlay {
  readonly entityRef: string;
  readonly patches: OverlayPatch[];
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export interface OverlayPatch {
  readonly path: string;
  readonly op: 'add' | 'replace' | 'remove';
  readonly value?: unknown;
}

export interface OverlayApplyResult {
  readonly entityRef: string;
  readonly patchesApplied: number;
}
```

- [ ] **Step 2: Create package.json and index.ts, commit**

```bash
git add plugins/entity-overlays-common/
git commit -s -m "feat(entity-overlays): add common types for entity overlay system"
```

---

### Task 6: Entity Overlays Backend

**Files:**

- Create: `plugins/entity-overlays-backend/src/plugin.ts`
- Create: `plugins/entity-overlays-backend/src/service/router.ts`
- Create: `plugins/entity-overlays-backend/src/database/OverlayStore.ts`
- Create: `plugins/entity-overlays-backend/src/database/migrations.ts`
- Create: `plugins/entity-overlays-backend/src/processor/OverlayProcessor.ts`
- Create: `plugins/entity-overlays-backend/src/index.ts`
- Create: `plugins/entity-overlays-backend/package.json`

**Interfaces:**

- Consumes: `@backstage/plugin-catalog-node` (CatalogProcessor), `coreServices.*`
- Produces: REST API for overlay CRUD, catalog processor that merges overlays on read

- [ ] **Step 1: Create database migration**

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('entity_overlays', table => {
    table.string('entity_ref').primary().notNullable();
    table.jsonb('patches').notNullable().defaultTo('[]');
    table.string('updated_by').notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}
```

- [ ] **Step 2: Create OverlayStore**

CRUD operations on `entity_overlays` table. Methods: `getOverlay(entityRef)`, `setOverlay(entityRef, patches, updatedBy)`, `deleteOverlay(entityRef)`, `listOverlays(filter?)`.

- [ ] **Step 3: Create OverlayProcessor — catalog processor**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import {
  CatalogProcessor,
  CatalogProcessorEmit,
} from '@backstage/plugin-catalog-node';
import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { OverlayStore } from '../database/OverlayStore';

export class OverlayProcessor implements CatalogProcessor {
  constructor(private readonly store: OverlayStore) {}

  getProcessorName(): string {
    return 'OverlayProcessor';
  }

  async preProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    const ref = stringifyEntityRef(entity);
    const overlay = await this.store.getOverlay(ref);
    if (!overlay || overlay.patches.length === 0) {
      return entity;
    }

    let result = { ...entity, metadata: { ...entity.metadata } };
    for (const patch of overlay.patches) {
      if (patch.op === 'add' || patch.op === 'replace') {
        if (patch.path.startsWith('metadata.annotations.')) {
          const key = patch.path.replace('metadata.annotations.', '');
          result.metadata.annotations = {
            ...result.metadata.annotations,
            [key]: patch.value as string,
          };
        } else if (patch.path.startsWith('metadata.labels.')) {
          const key = patch.path.replace('metadata.labels.', '');
          result.metadata.labels = {
            ...result.metadata.labels,
            [key]: patch.value as string,
          };
        }
      }
    }
    return result;
  }
}
```

- [ ] **Step 4: Create router.ts and plugin.ts**

Router with endpoints: `GET /overlays/:entityRef`, `PUT /overlays/:entityRef`, `DELETE /overlays/:entityRef`, `GET /overlays`.

Plugin registers the OverlayProcessor with the catalog via `catalogProcessingExtensionPoint`.

- [ ] **Step 5: Write tests, run, commit**

```bash
git add plugins/entity-overlays-backend/
git commit -s -m "feat(entity-overlays): add backend with overlay storage and catalog processor"
```

---

### Task 7: Entity Overlays Frontend

**Files:**

- Create: `plugins/entity-overlays/src/alpha/plugin.tsx`
- Create: `plugins/entity-overlays/src/components/OverlayEditor.tsx`
- Create: `plugins/entity-overlays/src/api/OverlayClient.ts`
- Create: `plugins/entity-overlays/src/api/ref.ts`
- Create: `plugins/entity-overlays/src/index.ts`
- Create: `plugins/entity-overlays/package.json`

**Interfaces:**

- Consumes: Overlays Backend REST API
- Produces: Entity content tab for editing overlays

- [ ] **Step 1-4: Create API client, OverlayEditor component, plugin registration as entity content tab**

The OverlayEditor shows current overlays for an entity (annotations, labels) and allows adding/editing/removing them. Registered as an entity content extension via `EntityContentBlueprint`.

- [ ] **Step 5: Commit**

```bash
git add plugins/entity-overlays/
git commit -s -m "feat(entity-overlays): add frontend overlay editor as entity tab"
```

---

### Task 8: Audit Log Common

**Files:**

- Create: `plugins/audit-log-common/src/types.ts`
- Create: `plugins/audit-log-common/src/index.ts`
- Create: `plugins/audit-log-common/package.json`

**Interfaces:**

- Produces: `AuditEvent`, `AuditQuery` types

- [ ] **Step 1: Create types.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

export interface AuditEvent {
  readonly id: string;
  readonly action: string;
  readonly actor: string;
  readonly entityRef?: string;
  readonly metadata?: Record<string, unknown>;
  readonly timestamp: string;
  readonly status: 'succeeded' | 'failed';
}

export interface AuditQuery {
  readonly actor?: string;
  readonly entityRef?: string;
  readonly action?: string;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface AuditQueryResult {
  readonly events: AuditEvent[];
  readonly totalCount: number;
}
```

- [ ] **Step 2: Package files, commit**

```bash
git add plugins/audit-log-common/
git commit -s -m "feat(audit-log): add common types for audit events and queries"
```

---

### Task 9: Audit Log Backend

**Files:**

- Create: `plugins/audit-log-backend/src/plugin.ts`
- Create: `plugins/audit-log-backend/src/service/router.ts`
- Create: `plugins/audit-log-backend/src/database/AuditStore.ts`
- Create: `plugins/audit-log-backend/src/database/migrations.ts`
- Create: `plugins/audit-log-backend/src/index.ts`
- Create: `plugins/audit-log-backend/package.json`

**Interfaces:**

- Consumes: `coreServices.auditor`, `coreServices.events` for audit event subscription
- Produces: REST API for querying audit events

- [ ] **Step 1: Create migration**

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_events', table => {
    table.string('id').primary().notNullable();
    table.string('action').notNullable().index();
    table.string('actor').notNullable().index();
    table.string('entity_ref').index();
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('timestamp').notNullable().index();
    table.string('status').notNullable().defaultTo('succeeded');
  });
}
```

- [ ] **Step 2: Create AuditStore**

Methods: `recordEvent(event)`, `queryEvents(query): AuditQueryResult`. PostgreSQL queries with filtering on actor, entityRef, action, time range, with pagination.

- [ ] **Step 3: Create plugin.ts — subscribes to auditor events**

```ts
export const auditLogPlugin = createBackendPlugin({
  pluginId: 'audit-log',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        events: coreServices.events,
      },
      async init({ config, logger, database, httpAuth, httpRouter, events }) {
        const knex = await database.getClient();
        const store = await AuditStore.create({ database: knex });

        events.subscribe({
          id: 'audit-log',
          topics: ['audit'],
          async onEvent(params) {
            const event = params.eventPayload as AuditEvent;
            await store.recordEvent(event);
          },
        });

        const router = createRouter({ store, httpAuth, logger, config });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({ path: '/', allow: 'user-cookie' });
      },
    });
  },
});
```

- [ ] **Step 4: Create router with GET /events endpoint, test, commit**

```bash
git add plugins/audit-log-backend/
git commit -s -m "feat(audit-log): add backend with event storage and query API"
```

---

### Task 10: Audit Log Frontend

**Files:**

- Create: `plugins/audit-log/src/alpha/plugin.tsx`
- Create: `plugins/audit-log/src/components/AuditLogPage.tsx`
- Create: `plugins/audit-log/src/api/AuditLogClient.ts`
- Create: `plugins/audit-log/src/api/ref.ts`
- Create: `plugins/audit-log/src/index.ts`
- Create: `plugins/audit-log/package.json`

**Interfaces:**

- Consumes: Audit Log Backend REST API
- Produces: Audit log viewer page with filtering

- [ ] **Step 1-3: Create API client, AuditLogPage with filterable table (actor, action, entity, date range), plugin registration**

AuditLogPage shows a table of events with filter controls. Uses `@backstage/core-components` Table with server-side filtering.

- [ ] **Step 4: Commit**

```bash
git add plugins/audit-log/
git commit -s -m "feat(audit-log): add frontend audit log viewer with filters"
```

---

### Task 11: Backend and Frontend Wiring

**Files:**

- Modify: `packages/backend/src/index.ts`
- Modify: `packages/app/src/App.tsx`
- Modify: `packages/app/src/modules/appModuleNav.tsx`

**Interfaces:**

- Consumes: All governance plugins
- Produces: Wired backend and frontend

- [ ] **Step 1: Update backend index.ts**

Replace `plugin-permission-backend-module-allow-all-policy` with RBAC plugin. Add overlays and audit log backends:

```ts
// Remove: backend.add(import('@backstage/plugin-permission-backend-module-allow-all-policy'));
// Add:
backend.add(import('@backstage/plugin-rbac-backend'));
backend.add(import('@backstage/plugin-entity-overlays-backend'));
backend.add(import('@backstage/plugin-audit-log-backend'));
```

- [ ] **Step 2: Update App.tsx — add frontend plugins**

```ts
import rbacPlugin from '@backstage/plugin-rbac/alpha';
import auditLogPlugin from '@backstage/plugin-audit-log/alpha';
import entityOverlaysPlugin from '@backstage/plugin-entity-overlays/alpha';

// In features array:
rbacPlugin,
auditLogPlugin,
entityOverlaysPlugin,
```

- [ ] **Step 3: Update sidebar — add RBAC and Audit Log nav items**

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/index.ts packages/app/src/App.tsx packages/app/src/modules/appModuleNav.tsx
git commit -s -m "feat: wire governance plugins into backend and frontend"
```

---

### Task 12: Integration Verification

- [ ] **Step 1:** `yarn tsc 2>&1 | tail -5` — no type errors
- [ ] **Step 2:** `CI=1 yarn test plugins/rbac-backend` — tests pass
- [ ] **Step 3:** `CI=1 yarn test plugins/entity-overlays-backend` — tests pass
- [ ] **Step 4:** `CI=1 yarn test plugins/audit-log-backend` — tests pass
- [ ] **Step 5:** `yarn start 2>&1 | head -30` — server starts without import errors

---

## Post-Governance: What's Ready for Sub-projects 3-6

| Component          | Status                                 |
| ------------------ | -------------------------------------- |
| RBAC policy engine | ✅ Replaces allow-all policy           |
| RBAC REST API      | ✅ Full CRUD for roles and bindings    |
| RBAC Frontend      | ✅ Role management UI                  |
| Entity Overlays    | ✅ Merge-on-read processor + editor UI |
| Audit Log          | ✅ Event capture + filterable viewer   |
| Permission checks  | ✅ All governance write ops protected  |

**Next:** Sub-project 3: Soundcheck (quality checks, fact collectors)
