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

import { TestDatabases } from '@backstage/backend-test-utils';
import { NpmShiftConfig } from '@backstage/plugin-fleetshift-common';
import { ShiftStore } from './ShiftStore';

jest.setTimeout(60_000);

const databases = TestDatabases.create();

async function createStore(databaseId: Parameters<typeof databases.init>[0]) {
  const knex = await databases.init(databaseId);
  return ShiftStore.create({ database: knex });
}

describe.each(databases.eachSupportedId())('ShiftStore (%s)', databaseId => {
  it('creates a shift and seeds one queued execution per target', async () => {
    const store = await createStore(databaseId);
    const config: NpmShiftConfig = {
      packageName: 'lodash',
      fromVersion: '4.0.0',
      toVersion: '4.17.21',
      applyCodemods: true,
    };

    const shift = await store.createShift(
      {
        title: 'Bump lodash',
        description: 'Upgrade lodash across the fleet',
        transformation: 'Bump lodash from 4.0.0 to 4.17.21',
        shiftType: 'npm-package',
        config,
        targets: [
          {
            repoUrl: 'https://gitlab.com/a/repo-one',
            branch: 'main',
            provider: 'gitlab',
          },
          {
            repoUrl: 'https://dev.azure.com/a/repo-two',
            branch: 'main',
            provider: 'azure-devops',
          },
        ],
      },
      'user:default/jane',
    );

    expect(shift.shiftType).toBe('npm-package');
    expect(shift.config).toEqual(config);
    expect(shift.status).toBe('created');
    expect(shift.executions).toHaveLength(2);
    expect(shift.executions[0]).toMatchObject({
      targetIndex: 0,
      targetRepoUrl: 'https://gitlab.com/a/repo-one',
      status: 'pending',
      targetStatus: 'queued',
    });
    expect(shift.executions[1]).toMatchObject({
      targetIndex: 1,
      targetRepoUrl: 'https://dev.azure.com/a/repo-two',
      status: 'pending',
      targetStatus: 'queued',
    });
  });

  it('tracks per-target status transitions independently', async () => {
    const store = await createStore(databaseId);
    const shift = await store.createShift(
      {
        title: 'AI shift',
        description: '',
        transformation: 'Do a thing',
        shiftType: 'ai-agent',
        config: { prompt: 'Do a thing' },
        targets: [
          {
            repoUrl: 'https://gitlab.com/a/repo-one',
            branch: 'main',
            provider: 'gitlab',
          },
        ],
      },
      'user:default/jane',
    );

    await store.markTargetStarted(shift.id, 0);
    let updated = await store.getShift(shift.id);
    expect(updated!.executions[0]).toMatchObject({
      status: 'running',
      targetStatus: 'cloning',
    });

    await store.updateTargetStatus(shift.id, 0, 'transforming');
    updated = await store.getShift(shift.id);
    expect(updated!.executions[0].targetStatus).toBe('transforming');

    await store.updateExecution(shift.id, 0, {
      status: 'succeeded',
      targetStatus: 'completed',
      mrUrl: 'https://gitlab.com/a/repo-one/-/merge_requests/1',
    });
    updated = await store.getShift(shift.id);
    expect(updated!.executions[0]).toMatchObject({
      status: 'succeeded',
      targetStatus: 'completed',
      mrUrl: 'https://gitlab.com/a/repo-one/-/merge_requests/1',
    });
    expect(updated!.executions[0].completedAt).toBeDefined();
  });

  it('records and retrieves per-target logs in order', async () => {
    const store = await createStore(databaseId);
    const shift = await store.createShift(
      {
        title: 'AI shift',
        description: '',
        transformation: 'Do a thing',
        shiftType: 'ai-agent',
        config: { prompt: 'Do a thing' },
        targets: [
          {
            repoUrl: 'https://gitlab.com/a/repo-one',
            branch: 'main',
            provider: 'gitlab',
          },
        ],
      },
      'user:default/jane',
    );

    await store.appendLog(shift.id, 0, 'info', 'Cloned repo');
    await store.appendLog(shift.id, 0, 'warn', 'Something looked off');
    await store.appendLog(shift.id, 0, 'error', 'It failed');

    const logs = await store.getLogs(shift.id, 0);
    expect(logs.map(log => [log.level, log.message])).toEqual([
      ['info', 'Cloned repo'],
      ['warn', 'Something looked off'],
      ['error', 'It failed'],
    ]);
  });

  it('stores and retrieves the diff for a single target', async () => {
    const store = await createStore(databaseId);
    const shift = await store.createShift(
      {
        title: 'AI shift',
        description: '',
        transformation: 'Do a thing',
        shiftType: 'ai-agent',
        config: { prompt: 'Do a thing' },
        targets: [
          {
            repoUrl: 'https://gitlab.com/a/repo-one',
            branch: 'main',
            provider: 'gitlab',
          },
        ],
      },
      'user:default/jane',
    );

    expect(await store.getDiff(shift.id, 0)).toEqual({
      targetRepoUrl: 'https://gitlab.com/a/repo-one',
      files: [],
    });

    await store.setDiff(shift.id, 0, [
      {
        path: 'src/index.ts',
        changeType: 'modified',
        hunks: [
          {
            header: '@@ -1,1 +1,1 @@',
            lines: [
              { type: 'remove', content: 'old', oldLineNumber: 1 },
              { type: 'add', content: 'new', newLineNumber: 1 },
            ],
          },
        ],
      },
    ]);

    const diff = await store.getDiff(shift.id, 0);
    expect(diff?.files).toHaveLength(1);
    expect(diff?.files[0].path).toBe('src/index.ts');
  });
});
