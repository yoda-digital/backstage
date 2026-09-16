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
import request from 'supertest';

describe('insights-backend plugin', () => {
  it('starts up and serves the insights API', async () => {
    const { server } = await startTestBackend({
      features: [
        import('../src/index'),
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    const postResponse = await request(server)
      .post('/api/insights/events')
      .send({ eventType: 'page.view', target: 'catalog' });
    expect(postResponse.status).toBe(201);
    expect(postResponse.body).toEqual({ recorded: true });

    const getResponse = await request(server).get('/api/insights/events');
    expect(getResponse.status).toBe(200);
    expect(Array.isArray(getResponse.body)).toBe(true);
    expect(getResponse.body.length).toBeGreaterThan(0);
    expect(getResponse.body[0]).toMatchObject({ eventType: 'page.view' });
  });
});
