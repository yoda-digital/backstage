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

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mockServices } from '@backstage/backend-test-utils';
import { Shift, ShiftTarget } from '@backstage/plugin-fleetshift-common';
import { NpmShiftExecutor } from './NpmShiftExecutor';
import { ShiftExecutorContext } from './ShiftEngine';

// `promisify(execFile)` relies on `execFile`'s `util.promisify.custom`
// implementation (which resolves `{ stdout, stderr }`); mocking
// `node:child_process` directly loses that, so `promisify` itself is
// mocked to always return a resolved `{ stdout, stderr }`. The mock
// function is created inside the factory (rather than closed over from
// module scope) to avoid a temporal-dead-zone error: jest hoists
// `jest.mock` calls above all imports, including transitive ones that
// import `node:util` before this file's own top-level `const`s would run.
jest.mock('node:util', () => ({
  ...jest.requireActual('node:util'),
  promisify: () => jest.fn(async () => ({ stdout: 'ok', stderr: '' })),
}));

function createShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 'shift-1',
    title: 'Bump lodash',
    description: '',
    transformation: 'Bump lodash from 4.0.0 to 4.17.21',
    shiftType: 'npm-package',
    config: {
      packageName: 'lodash',
      fromVersion: '4.0.0',
      toVersion: '4.17.21',
      applyCodemods: false,
    },
    targets: [],
    status: 'executing',
    executions: [],
    createdBy: 'user:default/jane',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createContext(
  workDir: string,
  overrides: Partial<ShiftExecutorContext> = {},
): ShiftExecutorContext {
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
    ...overrides,
  };
}

describe('NpmShiftExecutor', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), 'fleetshift-npm-'));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('bumps the dependency version, runs the pipeline, and opens a merge request', async () => {
    await writeFile(
      path.join(workDir, 'package.json'),
      JSON.stringify({ name: 'x', dependencies: { lodash: '4.0.0' } }),
    );
    const context = createContext(workDir);
    const executor = new NpmShiftExecutor();

    const result = await executor.execute(context);

    const updatedPackageJson = JSON.parse(
      await readFile(path.join(workDir, 'package.json'), 'utf-8'),
    );
    expect(updatedPackageJson.dependencies.lodash).toBe('4.17.21');
    expect(context.setStatus).toHaveBeenNthCalledWith(1, 'transforming');
    expect(context.setStatus).toHaveBeenNthCalledWith(2, 'testing');
    expect(context.setStatus).toHaveBeenNthCalledWith(3, 'creating_pr');
    expect(context.recordDiffFromWorkDir).toHaveBeenCalled();
    expect(context.provider.createMergeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ target: context.target, workDir }),
    );
    expect(result.mrUrl).toBe(
      'https://gitlab.com/a/repo-one/-/merge_requests/1',
    );
  });

  it('warns without failing when the package is not present in package.json', async () => {
    await writeFile(
      path.join(workDir, 'package.json'),
      JSON.stringify({ name: 'x', dependencies: {} }),
    );
    const context = createContext(workDir);
    const executor = new NpmShiftExecutor();

    await executor.execute(context);

    expect(context.log).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('lodash was not found'),
    );
  });
});
