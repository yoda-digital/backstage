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

import express from 'express';
import request from 'supertest';
import { mockCredentials, mockServices } from '@backstage/backend-test-utils';
import { Shift } from '@backstage/plugin-fleetshift-common';
import { createRouter } from './router';
import { ShiftStore } from '../database/ShiftStore';
import { ShiftEngine } from './ShiftEngine';

function createApp(options: {
  store: Partial<jest.Mocked<ShiftStore>>;
  engine: Partial<jest.Mocked<ShiftEngine>>;
}) {
  const router = createRouter({
      events: { publish: jest.fn() } as any,
    store: options.store as unknown as ShiftStore,
    engine: options.engine as unknown as ShiftEngine,
    httpAuth: mockServices.httpAuth({
      defaultCredentials: mockCredentials.user(),
    }),
    logger: mockServices.logger.mock(),
    config: mockServices.rootConfig(),
  });
  const app = express();
  app.use(router);
  return app;
}

const exampleShift: Shift = {
  id: 'shift-1',
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
  status: 'created',
  executions: [
    {
      targetIndex: 0,
      targetRepoUrl: 'https://gitlab.com/a/repo-one',
      status: 'pending',
      targetStatus: 'queued',
    },
  ],
  createdBy: mockCredentials.user().principal.userEntityRef,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('createRouter', () => {
  it('POST /shifts rejects an npm-package shift missing required config', async () => {
    const app = createApp({ store: {}, engine: {} });

    const response = await request(app)
      .post('/shifts')
      .send({
        title: 'Bump lodash',
        transformation: 'Bump lodash',
        shiftType: 'npm-package',
        config: { packageName: 'lodash' },
        targets: exampleShift.targets,
      });

    expect(response.status).toBe(400);
  });

  it('POST /shifts creates a shift and defaults to ai-agent when no type is given', async () => {
    const createShift = jest.fn().mockResolvedValue({
      ...exampleShift,
      shiftType: 'ai-agent',
      config: { prompt: 'Do a thing' },
    });
    const app = createApp({ store: { createShift }, engine: {} });

    const response = await request(app).post('/shifts').send({
      title: 'AI shift',
      transformation: 'Do a thing',
      targets: exampleShift.targets,
    });

    expect(response.status).toBe(201);
    expect(createShift).toHaveBeenCalledWith(
      expect.objectContaining({
        shiftType: 'ai-agent',
        config: { prompt: 'Do a thing' },
      }),
      mockCredentials.user().principal.userEntityRef,
    );
  });

  it('GET /shifts/:id/targets/:index/logs returns logs for a valid target', async () => {
    const getShift = jest.fn().mockResolvedValue(exampleShift);
    const getLogs = jest
      .fn()
      .mockResolvedValue([{ level: 'info', message: 'hi', timestamp: 'now' }]);
    const app = createApp({ store: { getShift, getLogs }, engine: {} });

    const response = await request(app).get('/shifts/shift-1/targets/0/logs');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { level: 'info', message: 'hi', timestamp: 'now' },
    ]);
    expect(getLogs).toHaveBeenCalledWith('shift-1', 0);
  });

  it('GET /shifts/:id/targets/:index/logs 404s for an out-of-range target', async () => {
    const getShift = jest.fn().mockResolvedValue(exampleShift);
    const app = createApp({ store: { getShift }, engine: {} });

    const response = await request(app).get('/shifts/shift-1/targets/9/logs');

    expect(response.status).toBe(404);
  });

  it('GET /shifts/:id/targets/:index/diff returns an empty diff when none recorded', async () => {
    const getShift = jest.fn().mockResolvedValue(exampleShift);
    const getDiff = jest.fn().mockResolvedValue(undefined);
    const app = createApp({ store: { getShift, getDiff }, engine: {} });

    const response = await request(app).get('/shifts/shift-1/targets/0/diff');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      targetRepoUrl: 'https://gitlab.com/a/repo-one',
      files: [],
    });
  });

  it('POST /shifts/:id/targets/:index/retry triggers executeTarget', async () => {
    const getShift = jest.fn().mockResolvedValue(exampleShift);
    const executeTarget = jest.fn().mockResolvedValue(undefined);
    const app = createApp({
      store: { getShift },
      engine: { executeTarget },
    });

    const response = await request(app).post('/shifts/shift-1/targets/0/retry');

    expect(response.status).toBe(202);
    expect(executeTarget).toHaveBeenCalledWith('shift-1', 0);
  });
});
