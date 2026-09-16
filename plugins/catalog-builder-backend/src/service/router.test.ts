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
import { createRouter } from './router';
import { JobStore } from '../database/JobStore';
import { IngestionEngine } from './IngestionEngine';
import { IngestionJob } from '../types';

function createApp(options: {
  store: Partial<jest.Mocked<JobStore>>;
  engine: Partial<jest.Mocked<IngestionEngine>>;
}) {
  const router = createRouter({
      events: { publish: jest.fn() } as any,
    store: options.store as unknown as JobStore,
    engine: options.engine as unknown as IngestionEngine,
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

const exampleJob: IngestionJob = {
  id: 'job-1',
  provider: 'gitlab',
  organization: 'platform',
  mode: 'portal-managed',
  status: 'pending',
  totalRepos: 1,
  processed: 0,
  succeeded: 0,
  failed: 0,
  errors: [],
  createdBy: mockCredentials.user().principal.userEntityRef,
  createdAt: new Date().toISOString(),
};

describe('createRouter', () => {
  it('GET /providers returns the configured providers', async () => {
    const engine: Partial<jest.Mocked<IngestionEngine>> = {
      listProviders: jest
        .fn()
        .mockReturnValue([
          {
            id: 'gitlab',
            name: 'GitLab',
            host: 'gitlab.com',
            authenticated: true,
          },
        ]),
    };
    const app = createApp({ store: {}, engine });

    const response = await request(app).get('/providers');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 'gitlab', name: 'GitLab', host: 'gitlab.com', authenticated: true },
    ]);
  });

  it('GET /organizations requires a valid provider', async () => {
    const app = createApp({ store: {}, engine: {} });

    const response = await request(app).get('/organizations?provider=bogus');

    expect(response.status).toBe(400);
  });

  it('GET /organizations returns organizations for a provider', async () => {
    const listOrganizations = jest
      .fn()
      .mockResolvedValue([{ id: 'platform', name: 'Platform' }]);
    const app = createApp({
      store: {},
      engine: { listOrganizations },
    });

    const response = await request(app).get('/organizations?provider=gitlab');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'platform', name: 'Platform' }]);
    expect(listOrganizations).toHaveBeenCalledWith('gitlab');
  });

  it('GET /repositories requires an organization', async () => {
    const app = createApp({ store: {}, engine: {} });

    const response = await request(app).get('/repositories?provider=gitlab');

    expect(response.status).toBe(400);
  });

  it('POST /ingest validates the request body', async () => {
    const app = createApp({ store: {}, engine: {} });

    const response = await request(app).post('/ingest').send({});

    expect(response.status).toBe(400);
  });

  it('POST /ingest starts an ingestion job', async () => {
    const startIngestion = jest.fn().mockResolvedValue(exampleJob);
    const app = createApp({
      store: {},
      engine: { startIngestion },
    });

    const response = await request(app)
      .post('/ingest')
      .send({
        provider: 'gitlab',
        organization: 'platform',
        mode: 'portal-managed',
        repositories: [{ id: '1', name: 'repo', fullName: 'platform/repo' }],
      });

    expect(response.status).toBe(202);
    expect(response.body).toEqual(exampleJob);
    expect(startIngestion).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'gitlab', organization: 'platform' }),
      mockCredentials.user().principal.userEntityRef,
    );
  });

  it('GET /jobs/:id returns 404 for an unknown job', async () => {
    const app = createApp({
      store: { getJob: jest.fn().mockResolvedValue(undefined) },
      engine: {},
    });

    const response = await request(app).get('/jobs/does-not-exist');

    expect(response.status).toBe(404);
  });

  it('GET /jobs/:id returns the job', async () => {
    const app = createApp({
      store: { getJob: jest.fn().mockResolvedValue(exampleJob) },
      engine: {},
    });

    const response = await request(app).get('/jobs/job-1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(exampleJob);
  });
});
