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

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as nodeUtil from 'node:util';
import { mockServices } from '@backstage/backend-test-utils';
import { Shift, ShiftTarget } from '@backstage/plugin-fleetshift-common';
import { OpenRewriteShiftExecutor } from './OpenRewriteShiftExecutor';
import { ShiftExecutorContext } from './ShiftEngine';

// `promisify(execFile)` relies on `execFile`'s `util.promisify.custom`
// implementation (which resolves `{ stdout, stderr }`); mocking
// `node:child_process` directly loses that, so `promisify` itself is
// mocked to always return a controllable async function instead. The mock
// function is created inside the factory (rather than closed over from
// module scope) and exposed as `__mockExecFileAsync` to avoid a
// temporal-dead-zone error: jest hoists `jest.mock` calls above all
// imports, including transitive ones that import `node:util` before this
// file's own top-level `const`s would run.
jest.mock('node:util', () => {
  const mockExecFileAsync = jest.fn(async () => ({ stdout: 'ok', stderr: '' }));
  return {
    ...jest.requireActual('node:util'),
    promisify: () => mockExecFileAsync,
    __mockExecFileAsync: mockExecFileAsync,
  };
});

const mockExecFileAsync = (
  nodeUtil as unknown as { __mockExecFileAsync: jest.Mock }
).__mockExecFileAsync;

function createShift(): Shift {
  return {
    id: 'shift-1',
    title: 'Migrate to Java 17',
    description: '',
    transformation: 'Apply OpenRewrite recipe',
    shiftType: 'openrewrite',
    config: {
      recipeName: 'org.openrewrite.java.migrate.UpgradeToJava17',
      recipeVersion: '2.0.0',
    },
    targets: [],
    status: 'executing',
    executions: [],
    createdBy: 'user:default/jane',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createContext(workDir: string): ShiftExecutorContext {
  const target: ShiftTarget = {
    repoUrl: 'https://gitlab.com/a/repo-one',
    branch: 'main',
    provider: 'gitlab',
  };
  return {
    shift: createShift(),
    target,
    targetIndex: 0,
    workDir,
    provider: {
      providerId: 'gitlab',
      cloneRepo: jest.fn().mockResolvedValue(undefined),
      createMergeRequest: jest
        .fn()
        .mockResolvedValue('https://gitlab.com/a/repo-one/-/merge_requests/1'),
      getMrStatus: jest.fn(),
    },
    logger: mockServices.logger.mock(),
    fetchApi: jest.fn(),
    aiGatewayModel: 'claude-sonnet-4-20250514',
    setStatus: jest.fn().mockResolvedValue(undefined),
    log: jest.fn().mockResolvedValue(undefined),
    setDiff: jest.fn().mockResolvedValue(undefined),
    recordDiffFromWorkDir: jest.fn().mockResolvedValue(undefined),
  };
}

describe('OpenRewriteShiftExecutor', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'fleetshift-openrewrite-'));
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('runs the maven recipe when a pom.xml is present', async () => {
    await writeFile(path.join(workDir, 'pom.xml'), '<project/>');
    const context = createContext(workDir);
    const executor = new OpenRewriteShiftExecutor();

    const result = await executor.execute(context);

    const commands = mockExecFileAsync.mock.calls.map(call => call[0]);
    expect(commands).toContain('mvn');
    expect(context.setStatus).toHaveBeenNthCalledWith(1, 'transforming');
    expect(context.setStatus).toHaveBeenNthCalledWith(2, 'testing');
    expect(context.setStatus).toHaveBeenNthCalledWith(3, 'creating_pr');
    expect(context.recordDiffFromWorkDir).toHaveBeenCalled();
    expect(result.mrUrl).toBe(
      'https://gitlab.com/a/repo-one/-/merge_requests/1',
    );
  });

  it('falls back to gradle when no pom.xml is present', async () => {
    const context = createContext(workDir);
    const executor = new OpenRewriteShiftExecutor();

    await executor.execute(context);

    const commands = mockExecFileAsync.mock.calls.map(call => call[0]);
    expect(commands).toContain('./gradlew');
  });
});
