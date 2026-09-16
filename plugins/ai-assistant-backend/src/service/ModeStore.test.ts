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

import { resolvePackagePath } from '@backstage/backend-plugin-api';
import { TestDatabases } from '@backstage/backend-test-utils';
import { ModeStore } from './ModeStore';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-ai-assistant-backend',
  'migrations',
);

describe('ModeStore', () => {
  const databases = TestDatabases.create({ ids: ['SQLITE_3'] });

  async function createStore() {
    const knex = await databases.init('SQLITE_3');
    await knex.migrate.latest({ directory: migrationsDir });
    return ModeStore.create(knex);
  }

  it('creates and fetches a mode owned by its creator', async () => {
    const store = await createStore();
    const created = await store.create('user:default/alice', {
      name: 'Incident Responder',
      description: 'Helps triage incidents',
      instructions: 'Be concise and focus on remediation steps.',
      visibility: 'private',
      processors: [{ type: 'planning', enabled: true }],
      maxSteps: 8,
      temperature: 0.2,
    });

    expect(created.id).toBeDefined();
    expect(created.ownerRef).toBe('user:default/alice');
    expect(created.usageCount30d).toBe(0);
    expect(created.processors).toEqual([{ type: 'planning', enabled: true }]);

    const fetched = await store.get(created.id, 'user:default/alice');
    expect(fetched).toEqual(created);
  });

  it('hides a private mode from other users but shows public ones to everyone', async () => {
    const store = await createStore();
    const priv = await store.create('user:default/alice', {
      name: 'Private mode',
      description: 'desc',
      instructions: 'instructions',
      visibility: 'private',
    });
    const pub = await store.create('user:default/alice', {
      name: 'Public mode',
      description: 'desc',
      instructions: 'instructions',
      visibility: 'public',
    });

    expect(await store.get(priv.id, 'user:default/bob')).toBeUndefined();
    expect((await store.get(pub.id, 'user:default/bob'))?.id).toBe(pub.id);

    const bobsList = await store.list('user:default/bob');
    expect(bobsList.map(m => m.id)).toEqual([pub.id]);

    const alicesList = await store.list('user:default/alice');
    expect(alicesList.map(m => m.id).sort()).toEqual([priv.id, pub.id].sort());
  });

  it('only allows the owner to update or delete a mode', async () => {
    const store = await createStore();
    const mode = await store.create('user:default/alice', {
      name: 'Original name',
      description: 'desc',
      instructions: 'instructions',
      visibility: 'private',
    });

    await expect(
      store.update(mode.id, 'user:default/bob', { name: 'Hijacked' }),
    ).rejects.toThrow(/do not own/);
    await expect(store.delete(mode.id, 'user:default/bob')).rejects.toThrow(
      /do not own/,
    );

    const updated = await store.update(mode.id, 'user:default/alice', {
      name: 'Updated name',
      visibility: 'public',
    });
    expect(updated.name).toBe('Updated name');
    expect(updated.visibility).toBe('public');

    await store.delete(mode.id, 'user:default/alice');
    expect(await store.get(mode.id, 'user:default/alice')).toBeUndefined();
  });

  it('ranks popular modes by 30-day usage count', async () => {
    const store = await createStore();
    const low = await store.create('user:default/alice', {
      name: 'Low usage',
      description: 'desc',
      instructions: 'instructions',
      visibility: 'public',
    });
    const high = await store.create('user:default/alice', {
      name: 'High usage',
      description: 'desc',
      instructions: 'instructions',
      visibility: 'public',
    });

    await store.recordUsage(low.id);
    await store.recordUsage(high.id);
    await store.recordUsage(high.id);
    await store.recordUsage(high.id);

    const popular = await store.popular(undefined, 5);
    expect(popular.map(m => m.id)).toEqual([high.id, low.id]);
    expect(popular[0].usageCount30d).toBe(3);
  });
});
