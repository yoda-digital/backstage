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

describe('devex-metrics-backend plugin', () => {
  it('starts up and serves the devex-metrics API', async () => {
    const { server } = await startTestBackend({
      features: [
        import('../src/index'),
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    const getResponse = await request(server)
      .get('/api/devex-metrics/dora')
      .query({
        metric: 'deployment_frequency',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T00:00:00.000Z',
      });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toMatchObject({
      metric: 'deployment_frequency',
      points: expect.any(Array),
    });

    const postResponse = await request(server)
      .post('/api/devex-metrics/surveys')
      .send({
        id: 'dev-satisfaction',
        title: 'Developer Satisfaction',
        questions: [
          {
            id: 'q1',
            text: 'How satisfied are you?',
            type: 'rating',
            required: true,
          },
        ],
      });
    expect(postResponse.status).toBe(201);
    expect(postResponse.body).toMatchObject({
      id: 'dev-satisfaction',
      title: 'Developer Satisfaction',
    });

    const surveysResponse = await request(server).get(
      '/api/devex-metrics/surveys',
    );
    expect(surveysResponse.status).toBe(200);
    expect(surveysResponse.body).toHaveLength(1);
  });
});
