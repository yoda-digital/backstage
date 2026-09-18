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
  resolvePackagePath,
  DatabaseService,
} from '@backstage/backend-plugin-api';
import { ConflictError, NotFoundError } from '@backstage/errors';
import type {
  RbacRole,
  RbacPolicyRule,
  RbacSubject,
  RbacRoleBinding,
  RbacPolicyRecord,
  RbacPolicyStatus,
  RbacPolicyStrategy,
  RbacConditionalRuleRecord,
} from '@backstage/plugin-rbac-common';
import type { Knex } from 'knex';
import { v4 as uuid } from 'uuid';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-rbac-backend',
  'migrations',
);

/** @internal */
export interface CreatePolicyInput {
  id?: string;
  name: string;
  status?: RbacPolicyStatus;
  strategy?: RbacPolicyStrategy;
  rules?: RbacPolicyRule[];
}

/** @internal */
export interface UpdatePolicyInput {
  name?: string;
  strategy?: RbacPolicyStrategy;
  rules?: RbacPolicyRule[];
}

/** @internal */
export class RbacStore {
  private constructor(private readonly db: Knex) {}

  static async create(options: {
    database: DatabaseService;
  }): Promise<RbacStore> {
    const client = await options.database.getClient();
    await client.migrate.latest({ directory: migrationsDir, tableName: 'knex_migrations_rbac' });
    return new RbacStore(client);
  }

  async listRoles(): Promise<RbacRole[]> {
    const rows = await this.db('rbac_roles').select('*');
    return rows.map(row => this.toRole(row));
  }

  async getRole(name: string): Promise<RbacRole | undefined> {
    const row = await this.db('rbac_roles').where({ name }).first();
    if (!row) {
      return undefined;
    }
    return this.toRole(row);
  }

  async createRole(role: RbacRole): Promise<void> {
    await this.db('rbac_roles').insert({
      name: role.name,
      description: role.description,
      permissions: JSON.stringify(role.permissions),
      metadata: JSON.stringify(role.metadata ?? {}),
      policy_id: role.policyId ?? null,
    });
  }

  async updateRole(name: string, role: Partial<RbacRole>): Promise<void> {
    const update: Record<string, unknown> = { updated_at: this.db.fn.now() };
    if (role.description !== undefined) {
      update.description = role.description;
    }
    if (role.permissions !== undefined) {
      update.permissions = JSON.stringify(role.permissions);
    }
    if (role.metadata !== undefined) {
      update.metadata = JSON.stringify(role.metadata);
    }
    if (role.policyId !== undefined) {
      update.policy_id = role.policyId ?? null;
    }
    await this.db('rbac_roles').where({ name }).update(update);
  }

  async deleteRole(name: string): Promise<void> {
    await this.db('rbac_roles').where({ name }).delete();
  }

  async listBindings(role?: string): Promise<RbacRoleBinding[]> {
    let query = this.db('rbac_bindings').select('*');
    if (role) {
      query = query.where({ role });
    }
    const rows = await query;

    const grouped = new Map<string, RbacSubject[]>();
    for (const row of rows) {
      const subjects = grouped.get(row.role) ?? [];
      subjects.push({
        kind: row.subject_kind as 'user' | 'group',
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

  async getAllPermissionsForSubjects(
    refs: Array<{ kind: string; name: string; namespace?: string }>,
  ): Promise<RbacPolicyRule[]> {
    const allRoles = new Set<string>();
    for (const ref of refs) {
      const roles = await this.getRolesForSubject(
        ref.kind,
        ref.name,
        ref.namespace,
      );
      for (const r of roles) {
        allRoles.add(r);
      }
    }

    const rules: RbacPolicyRule[] = [];
    for (const roleName of allRoles) {
      const role = await this.getRole(roleName);
      if (role) {
        rules.push(...role.permissions);
      }
    }
    return rules;
  }

  /**
   * Lists all roles bound to a given subject that are visible under the
   * given policy, i.e. roles whose `policy_id` matches the given policy,
   * plus legacy roles that predate the policy lifecycle and are not
   * scoped to any policy at all.
   */
  async listRolesForPolicy(
    roleNames: string[],
    policyId: string | undefined,
  ): Promise<RbacRole[]> {
    if (roleNames.length === 0) {
      return [];
    }
    const rows = await this.db('rbac_roles').whereIn('name', roleNames);
    return rows
      .filter(row => !row.policy_id || row.policy_id === policyId)
      .map(row => this.toRole(row));
  }

  async createPolicy(policy: CreatePolicyInput): Promise<RbacPolicyRecord> {
    const id = policy.id ?? uuid();
    await this.db('rbac_policies').insert({
      id,
      name: policy.name,
      status: policy.status ?? 'draft',
      strategy: policy.strategy ?? 'first-match',
      rules: JSON.stringify(policy.rules ?? []),
    });
    const created = await this.getPolicy(id);
    if (!created) {
      throw new NotFoundError(`Policy '${id}' not found after creation`);
    }
    return created;
  }

  async getPolicy(id: string): Promise<RbacPolicyRecord | undefined> {
    const row = await this.db('rbac_policies').where({ id }).first();
    if (!row) {
      return undefined;
    }
    return this.toPolicy(row);
  }

  async listPolicies(): Promise<RbacPolicyRecord[]> {
    const rows = await this.db('rbac_policies').select('*');
    return rows.map(row => this.toPolicy(row));
  }

  /**
   * Returns the single currently published policy, if one exists.
   */
  async getActivePolicy(): Promise<RbacPolicyRecord | undefined> {
    const row = await this.db('rbac_policies')
      .where({ status: 'published' })
      .orderBy('published_at', 'desc')
      .first();
    if (!row) {
      return undefined;
    }
    return this.toPolicy(row);
  }

  async updatePolicy(id: string, patch: UpdatePolicyInput): Promise<void> {
    const existing = await this.getPolicy(id);
    if (!existing) {
      throw new NotFoundError(`Policy '${id}' not found`);
    }
    const update: Record<string, unknown> = { updated_at: this.db.fn.now() };
    if (patch.name !== undefined) {
      update.name = patch.name;
    }
    if (patch.strategy !== undefined) {
      update.strategy = patch.strategy;
    }
    if (patch.rules !== undefined) {
      update.rules = JSON.stringify(patch.rules);
    }
    await this.db('rbac_policies').where({ id }).update(update);
  }

  /**
   * Publishes the given draft policy, making it the single active policy.
   * Any previously published policy transitions to `inactive`.
   */
  async publishPolicy(id: string): Promise<RbacPolicyRecord> {
    return this.db.transaction(async trx => {
      const target = await trx('rbac_policies').where({ id }).first();
      if (!target) {
        throw new NotFoundError(`Policy '${id}' not found`);
      }
      if (target.status === 'published') {
        return this.toPolicy(target);
      }

      await trx('rbac_policies')
        .where({ status: 'published' })
        .update({ status: 'inactive', updated_at: trx.fn.now() });

      await trx('rbac_policies').where({ id }).update({
        status: 'published',
        published_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });

      const published = await trx('rbac_policies').where({ id }).first();
      return this.toPolicy(published);
    });
  }

  /**
   * Clones an inactive policy into a new draft, so it can be edited and
   * republished without mutating the archived original.
   */
  async republishPolicy(id: string): Promise<RbacPolicyRecord> {
    const source = await this.getPolicy(id);
    if (!source) {
      throw new NotFoundError(`Policy '${id}' not found`);
    }
    if (source.status !== 'inactive') {
      throw new ConflictError(
        `Policy '${id}' must be inactive to be republished, got '${source.status}'`,
      );
    }
    return this.createPolicy({
      name: source.name,
      status: 'draft',
      strategy: source.strategy,
      rules: source.rules,
    });
  }

  /**
   * Deletes a draft policy. Published and inactive policies are read-only
   * and cannot be deleted directly.
   */
  async deletePolicy(id: string): Promise<void> {
    const existing = await this.getPolicy(id);
    if (!existing) {
      throw new NotFoundError(`Policy '${id}' not found`);
    }
    if (existing.status !== 'draft') {
      throw new ConflictError(
        `Policy '${id}' must be a draft to be deleted, got '${existing.status}'`,
      );
    }
    await this.db('rbac_policies').where({ id }).delete();
  }

  async listConditionalRules(): Promise<RbacConditionalRuleRecord[]> {
    const rows = await this.db('rbac_conditional_rules').select('*');
    return rows.map(row => this.toConditionalRule(row));
  }

  async addConditionalRule(rule: RbacConditionalRuleRecord): Promise<void> {
    await this.db('rbac_conditional_rules')
      .insert({
        id: rule.id,
        name: rule.name,
        description: rule.description ?? null,
        resource_type: rule.resourceType,
        params_schema: rule.paramsSchema
          ? JSON.stringify(rule.paramsSchema)
          : null,
        plugin_id: rule.pluginId,
      })
      .onConflict(['plugin_id', 'name'])
      .merge();
  }

  private toRole(row: Record<string, unknown>): RbacRole {
    return {
      name: row.name as string,
      description: row.description as string,
      permissions: JSON.parse(row.permissions as string),
      metadata: JSON.parse(row.metadata as string),
      policyId: (row.policy_id as string | null) ?? undefined,
    };
  }

  private toPolicy(row: Record<string, unknown>): RbacPolicyRecord {
    const rules = row.rules as string | object;
    return {
      id: row.id as string,
      name: row.name as string,
      status: row.status as RbacPolicyStatus,
      strategy: row.strategy as RbacPolicyStrategy,
      rules: typeof rules === 'string' ? JSON.parse(rules) : rules ?? [],
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString(),
      publishedAt: row.published_at
        ? new Date(row.published_at as string).toISOString()
        : undefined,
    };
  }

  private toConditionalRule(
    row: Record<string, unknown>,
  ): RbacConditionalRuleRecord {
    const schema = row.params_schema as string | object | null;
    return {
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string | null) ?? undefined,
      resourceType: row.resource_type as string,
      pluginId: row.plugin_id as string,
      paramsSchema:
        typeof schema === 'string' ? JSON.parse(schema) : schema ?? undefined,
    };
  }
}
