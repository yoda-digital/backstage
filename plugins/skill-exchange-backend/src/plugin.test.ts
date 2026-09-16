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

import { createServiceFactory } from '@backstage/backend-plugin-api';
import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import { notificationService } from '@backstage/plugin-notifications-node';
import request from 'supertest';

const notificationsStubFactory = createServiceFactory({
  service: notificationService,
  deps: {},
  async factory() {
    return { send: async () => {} };
  },
});

describe('skill-exchange-backend plugin', () => {
  it('starts up and serves the skill-exchange API', async () => {
    const { server } = await startTestBackend({
      features: [
        import('../src/index'),
        notificationsStubFactory,
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    const getResponse = await request(server).get('/api/skill-exchange/gigs');
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual([]);

    const postResponse = await request(server)
      .post('/api/skill-exchange/gigs')
      .send({
        title: 'Need help with Kubernetes',
        type: 'mentor',
        direction: 'request',
        skills: ['kubernetes'],
      });
    expect(postResponse.status).toBe(201);
    expect(postResponse.body).toMatchObject({
      gig: { title: 'Need help with Kubernetes' },
      matches: [],
    });

    const afterPost = await request(server).get('/api/skill-exchange/gigs');
    expect(afterPost.status).toBe(200);
    expect(afterPost.body).toHaveLength(1);
  });
});
