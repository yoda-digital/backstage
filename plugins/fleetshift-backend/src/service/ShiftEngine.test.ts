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

import { mockServices, TestDatabases } from '@backstage/backend-test-utils';
import { FleetshiftProvider } from '@backstage/plugin-fleetshift-node';
import { ShiftStore } from '../database/ShiftStore';
import { ShiftEngine } from './ShiftEngine';
import { NpmShiftExecutor } from './NpmShiftExecutor';
import { OpenRewriteShiftExecutor } from './OpenRewriteShiftExecutor';

jest.setTimeout(60_000);

const databases = TestDatabases.create();

function createFakeProvider(
  overrides: Partial<FleetshiftProvider> = {},
): FleetshiftProvider {
  return {
    providerId: 'gitlab',
    cloneRepo: jest.fn().mockResolvedValue(undefined),
    createMergeRequest: jest
      .fn()
      .mockResolvedValue('https://gitlab.com/a/repo-one/-/merge_requests/1'),
    getMrStatus: jest.fn(),
    ...overrides,
  };
}

describe.each(databases.eachSupportedId())('ShiftEngine (%s)', databaseId => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function createEngine(providers: Map<string, FleetshiftProvider>) {
    const knex = await databases.init(databaseId);
    const store = await ShiftStore.create({ database: knex });
    const engine = new ShiftEngine(
      store,
      providers,
      undefined,
      'claude-sonnet-4-20250514',
      jest.fn() as unknown as typeof fetch,
      mockServices.logger.mock(),
    );
    return { store, engine };
  }

  it('executes an ai-agent shift target through cloning, testing and PR creation', async () => {
    const provider = createFakeProvider();
    const { store, engine } = await createEngine(
      new Map([['gitlab', provider]]),
    );
    const shift = await store.createShift(
      {
        title: 'AI shift',
        description: 'desc',
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
    await store.updateStatus(shift.id, 'planning');
    await store.updateStatus(shift.id, 'planned');

    await engine.executeShift(shift.id);

    const finished = await store.getShift(shift.id);
    expect(finished!.status).toBe('completed');
    expect(finished!.executions[0]).toMatchObject({
      status: 'succeeded',
      targetStatus: 'completed',
      mrUrl: 'https://gitlab.com/a/repo-one/-/merge_requests/1',
    });
    expect(provider.cloneRepo).toHaveBeenCalled();
    expect(provider.createMergeRequest).toHaveBeenCalled();
  });

  it('dispatches npm-package shifts to the NpmShiftExecutor', async () => {
    const executeSpy = jest
      .spyOn(NpmShiftExecutor.prototype, 'execute')
      .mockResolvedValue({
        mrUrl: 'https://gitlab.com/a/repo-one/-/merge_requests/2',
      });
    const provider = createFakeProvider();
    const { store, engine } = await createEngine(
      new Map([['gitlab', provider]]),
    );
    const shift = await store.createShift(
      {
        title: 'Bump lodash',
        description: '',
        transformation: 'Bump lodash',
        shiftType: 'npm-package',
        config: {
          packageName: 'lodash',
          fromVersion: '4.0.0',
          toVersion: '4.17.21',
          applyCodemods: false,
        },
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
    await store.updateStatus(shift.id, 'planning');
    await store.updateStatus(shift.id, 'planned');

    await engine.executeShift(shift.id);

    expect(executeSpy).toHaveBeenCalled();
    const finished = await store.getShift(shift.id);
    expect(finished!.executions[0].mrUrl).toBe(
      'https://gitlab.com/a/repo-one/-/merge_requests/2',
    );
  });

  it('dispatches openrewrite shifts to the OpenRewriteShiftExecutor', async () => {
    const executeSpy = jest
      .spyOn(OpenRewriteShiftExecutor.prototype, 'execute')
      .mockResolvedValue({
        mrUrl: 'https://gitlab.com/a/repo-one/-/merge_requests/3',
      });
    const provider = createFakeProvider();
    const { store, engine } = await createEngine(
      new Map([['gitlab', provider]]),
    );
    const shift = await store.createShift(
      {
        title: 'Migrate to Java 17',
        description: '',
        transformation: 'Apply recipe',
        shiftType: 'openrewrite',
        config: {
          recipeName: 'org.openrewrite.java.migrate.UpgradeToJava17',
          recipeVersion: '2.0.0',
        },
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
    await store.updateStatus(shift.id, 'planning');
    await store.updateStatus(shift.id, 'planned');

    await engine.executeShift(shift.id);

    expect(executeSpy).toHaveBeenCalled();
    const finished = await store.getShift(shift.id);
    expect(finished!.executions[0].mrUrl).toBe(
      'https://gitlab.com/a/repo-one/-/merge_requests/3',
    );
  });

  it('marks a target failed when cloning throws, without failing the other targets', async () => {
    const provider = createFakeProvider({
      cloneRepo: jest
        .fn()
        .mockRejectedValueOnce(new Error('clone failed'))
        .mockResolvedValueOnce(undefined),
    });
    const { store, engine } = await createEngine(
      new Map([['gitlab', provider]]),
    );
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
          {
            repoUrl: 'https://gitlab.com/a/repo-two',
            branch: 'main',
            provider: 'gitlab',
          },
        ],
      },
      'user:default/jane',
    );
    await store.updateStatus(shift.id, 'planning');
    await store.updateStatus(shift.id, 'planned');

    await engine.executeShift(shift.id);

    const finished = await store.getShift(shift.id);
    expect(finished!.status).toBe('partially_completed');
    expect(finished!.executions[0]).toMatchObject({
      status: 'failed',
      targetStatus: 'failed',
    });
    expect(finished!.executions[1]).toMatchObject({
      status: 'succeeded',
      targetStatus: 'completed',
    });
  });

  it('fails a target immediately when no provider is registered', async () => {
    const { store, engine } = await createEngine(new Map());
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
    await store.updateStatus(shift.id, 'planning');
    await store.updateStatus(shift.id, 'planned');

    await engine.executeShift(shift.id);

    const finished = await store.getShift(shift.id);
    expect(finished!.status).toBe('failed');
    expect(finished!.executions[0]).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('No provider registered'),
    });
  });

  it('re-executes a single target via executeTarget without touching the others', async () => {
    const provider = createFakeProvider();
    const { store, engine } = await createEngine(
      new Map([['gitlab', provider]]),
    );
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
    await store.updateStatus(shift.id, 'planning');
    await store.updateStatus(shift.id, 'planned');
    await engine.executeShift(shift.id);

    await engine.executeTarget(shift.id, 0);

    expect(provider.cloneRepo).toHaveBeenCalledTimes(2);
    const finished = await store.getShift(shift.id);
    expect(finished!.executions[0].status).toBe('succeeded');
  });

  it('generates a deterministic plan for npm-package shifts without calling the AI Gateway', async () => {
    const fetchApi = jest.fn();
    const knex = await databases.init(databaseId);
    const store = await ShiftStore.create({ database: knex });
    const engine = new ShiftEngine(
      store,
      new Map(),
      'https://ai-gateway.example.com',
      'claude-sonnet-4-20250514',
      fetchApi as unknown as typeof fetch,
      mockServices.logger.mock(),
    );
    const shift = await store.createShift(
      {
        title: 'Bump lodash',
        description: '',
        transformation: 'Bump lodash',
        shiftType: 'npm-package',
        config: {
          packageName: 'lodash',
          fromVersion: '4.0.0',
          toVersion: '4.17.21',
          applyCodemods: false,
        },
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

    await engine.planShift(shift.id);

    expect(fetchApi).not.toHaveBeenCalled();
    const planned = await store.getShift(shift.id);
    expect(planned!.status).toBe('planned');
    expect(planned!.plan?.generatedBy).toBe('npm-package');
    expect(planned!.plan?.steps.length).toBeGreaterThan(0);
  });
});
