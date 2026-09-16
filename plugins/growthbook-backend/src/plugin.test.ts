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

import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import { registerMswTestHooks } from '@backstage/backend-test-utils';
import { http, HttpResponse, passthrough } from 'msw';
import { setupServer } from 'msw/node';
import request from 'supertest';

const worker = setupServer();
registerMswTestHooks(worker);

describe('growthbook-backend plugin', () => {
  it('starts up and proxies the GrowthBook API', async () => {
    const { server } = await startTestBackend({
      features: [
        import('../src/index'),
        mockServices.rootConfig.factory({
          data: {
            growthbook: {
              apiUrl: 'https://growthbook.example.com',
              apiKey: 'test-key',
            },
          },
        }),
      ],
    });

    // Let requests to our own test server through, and mock only the
    // upstream GrowthBook API that the plugin proxies to.
    worker.use(
      http.all(new RegExp(`^https?://[^/]+:${server.port()}/.*`), passthrough),
      http.get('https://growthbook.example.com/api/v1/features', () => {
        return HttpResponse.json({ features: [] });
      }),
      http.post('https://growthbook.example.com/api/v1/features', () => {
        return HttpResponse.json(
          { feature: { id: 'my-feature' } },
          {
            status: 201,
          },
        );
      }),
    );

    const getResponse = await request(server).get('/api/growthbook/features');
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual({ features: [] });

    const postResponse = await request(server)
      .post('/api/growthbook/features')
      .send({ id: 'my-feature' });
    expect(postResponse.status).toBe(201);
    expect(postResponse.body).toEqual({ feature: { id: 'my-feature' } });
  });
});
