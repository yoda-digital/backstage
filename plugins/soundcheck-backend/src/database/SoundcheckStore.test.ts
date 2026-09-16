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

import { TestDatabaseId, TestDatabases } from '@backstage/backend-test-utils';
import { NotFoundError } from '@backstage/errors';
import { DateTime } from 'luxon';
import { SoundcheckStore } from './SoundcheckStore';

jest.setTimeout(60_000);

const databases = TestDatabases.create();

async function createStore(databaseId: TestDatabaseId) {
  const knex = await databases.init(databaseId);
  return SoundcheckStore.create({ database: knex });
}

describe.each(databases.eachSupportedId())(
  'SoundcheckStore exemptions (%s)',
  databaseId => {
    it('creates, lists, revokes and restores an exemption, and reports isExempt', async () => {
      const store = await createStore(databaseId);
      await store.upsertCheck({
        id: 'readme-exists',
        name: 'README exists',
        description: '...',
        factRef: 'scm:default/readme',
        rule: { field: 'exists', operator: 'equal', value: true },
      });

      expect(
        await store.isExempt('readme-exists', 'component:default/foo'),
      ).toBe(false);

      const exemption = await store.createExemption({
        checkId: 'readme-exists',
        entityRef: 'component:default/foo',
        reason: 'Legacy service, README tracked elsewhere',
        grantedBy: 'user:default/alice',
      });
      expect(exemption.status).toEqual('active');
      expect(exemption.id).toBeDefined();

      expect(
        await store.isExempt('readme-exists', 'component:default/foo'),
      ).toBe(true);

      const listed = await store.listExemptions({
        checkId: 'readme-exists',
      });
      expect(listed).toHaveLength(1);
      expect(listed[0]).toMatchObject({
        checkId: 'readme-exists',
        entityRef: 'component:default/foo',
        status: 'active',
      });

      await store.revokeExemption(exemption.id, 'user:default/bob');
      expect(
        await store.isExempt('readme-exists', 'component:default/foo'),
      ).toBe(false);
      const [revoked] = await store.listExemptions({
        entityRef: 'component:default/foo',
      });
      expect(revoked.status).toEqual('revoked');
      expect(revoked.revokedBy).toEqual('user:default/bob');
      expect(revoked.revokedAt).toBeDefined();

      await store.restoreExemption(exemption.id);
      expect(
        await store.isExempt('readme-exists', 'component:default/foo'),
      ).toBe(true);
    });

    it('rejects revoking or restoring an exemption that does not exist', async () => {
      const store = await createStore(databaseId);
      await expect(
        store.revokeExemption('does-not-exist', 'user:default/alice'),
      ).rejects.toThrow(NotFoundError);
      await expect(store.restoreExemption('does-not-exist')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('deletes check results older than the retention period', async () => {
      const store = await createStore(databaseId);
      await store.upsertCheckResult({
        checkId: 'readme-exists',
        entityRef: 'component:default/old',
        status: 'pass',
        evaluatedAt: DateTime.fromISO(
          '2000-01-01T00:00:00.000Z',
        ).toISO() as string,
      });
      await store.upsertCheckResult({
        checkId: 'readme-exists',
        entityRef: 'component:default/recent',
        status: 'pass',
        evaluatedAt: DateTime.now().toISO() as string,
      });

      const deleted = await store.deleteExpiredCheckResults(120);
      expect(deleted).toEqual(1);

      const remaining = await store.getCheckResults('component:default/old');
      expect(remaining).toHaveLength(0);
      const stillThere = await store.getCheckResults(
        'component:default/recent',
      );
      expect(stillThere).toHaveLength(1);
    });
  },
);
