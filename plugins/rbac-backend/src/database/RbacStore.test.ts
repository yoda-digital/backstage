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
  mockServices,
  TestDatabaseId,
  TestDatabases,
} from '@backstage/backend-test-utils';
import { RbacStore } from './RbacStore';

jest.setTimeout(60_000);

const databases = TestDatabases.create();

async function createStore(databaseId: TestDatabaseId) {
  const knex = await databases.init(databaseId);
  const database = mockServices.database({ knex, migrations: { skip: false } });
  return RbacStore.create({ database });
}

describe.each(databases.eachSupportedId())('RbacStore (%s)', databaseId => {
  it('creates, publishes and republishes policies through their lifecycle', async () => {
    const store = await createStore(databaseId);

    const draft = await store.createPolicy({
      name: 'my-policy',
      rules: [{ permission: 'catalog.entity.read', action: 'allow' }],
    });
    expect(draft.status).toEqual('draft');
    expect(draft.strategy).toEqual('first-match');
    expect(draft.rules).toEqual([
      { permission: 'catalog.entity.read', action: 'allow' },
    ]);

    expect(await store.getActivePolicy()).toBeUndefined();

    const published = await store.publishPolicy(draft.id);
    expect(published.status).toEqual('published');
    expect(published.publishedAt).toBeDefined();

    const active = await store.getActivePolicy();
    expect(active?.id).toEqual(draft.id);

    // Publishing a second policy demotes the first to inactive.
    const secondDraft = await store.createPolicy({ name: 'second-policy' });
    const secondPublished = await store.publishPolicy(secondDraft.id);
    expect(secondPublished.status).toEqual('published');

    const firstAfterDemotion = await store.getPolicy(draft.id);
    expect(firstAfterDemotion?.status).toEqual('inactive');

    const republished = await store.republishPolicy(firstAfterDemotion!.id);
    expect(republished.status).toEqual('draft');
    expect(republished.id).not.toEqual(firstAfterDemotion!.id);
    expect(republished.rules).toEqual(firstAfterDemotion!.rules);

    await expect(store.republishPolicy(secondPublished.id)).rejects.toThrow(
      /must be inactive/,
    );

    const all = await store.listPolicies();
    expect(all.map(p => p.id).sort()).toEqual(
      [draft.id, secondDraft.id, republished.id].sort(),
    );
  });

  it('updates policy fields', async () => {
    const store = await createStore(databaseId);
    const policy = await store.createPolicy({ name: 'to-update' });

    await store.updatePolicy(policy.id, {
      name: 'renamed',
      strategy: 'any-allow',
      rules: [{ permission: '*', action: 'deny' }],
    });

    const updated = await store.getPolicy(policy.id);
    expect(updated).toMatchObject({
      name: 'renamed',
      strategy: 'any-allow',
      rules: [{ permission: '*', action: 'deny' }],
    });

    await expect(
      store.updatePolicy('does-not-exist', { name: 'x' }),
    ).rejects.toThrow(/not found/);
  });

  it('scopes roles to a policy via listRolesForPolicy', async () => {
    const store = await createStore(databaseId);
    const policy = await store.createPolicy({ name: 'scoped-policy' });
    const otherPolicy = await store.createPolicy({ name: 'other-policy' });

    await store.createRole({
      name: 'scoped-role',
      description: '',
      permissions: [],
      policyId: policy.id,
    });
    await store.createRole({
      name: 'legacy-role',
      description: '',
      permissions: [],
    });
    await store.createRole({
      name: 'other-policy-role',
      description: '',
      permissions: [],
      policyId: otherPolicy.id,
    });

    const visible = await store.listRolesForPolicy(
      ['scoped-role', 'legacy-role', 'other-policy-role'],
      policy.id,
    );
    expect(visible.map(r => r.name).sort()).toEqual([
      'legacy-role',
      'scoped-role',
    ]);
  });

  it('stores and lists conditional rules', async () => {
    const store = await createStore(databaseId);

    await store.addConditionalRule({
      id: 'rbac:HAS_TAG',
      name: 'HAS_TAG',
      description: 'Allow entities with the specified tag',
      resourceType: 'catalog-entity',
      pluginId: 'rbac',
    });

    const rules = await store.listConditionalRules();
    expect(rules).toEqual([
      {
        id: 'rbac:HAS_TAG',
        name: 'HAS_TAG',
        description: 'Allow entities with the specified tag',
        resourceType: 'catalog-entity',
        pluginId: 'rbac',
        paramsSchema: undefined,
      },
    ]);

    // Re-adding the same (pluginId, name) upserts rather than conflicting.
    await store.addConditionalRule({
      id: 'rbac:HAS_TAG',
      name: 'HAS_TAG',
      description: 'updated description',
      resourceType: 'catalog-entity',
      pluginId: 'rbac',
    });
    const updatedRules = await store.listConditionalRules();
    expect(updatedRules).toHaveLength(1);
    expect(updatedRules[0].description).toEqual('updated description');
  });
});
