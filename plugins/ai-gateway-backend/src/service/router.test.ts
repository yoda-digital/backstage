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

import { mockCredentials, mockServices } from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';
import { createRouter } from './router';
import { ProviderManager } from './ProviderManager';
import { UsageTracker } from './UsageTracker';

describe('createRouter', () => {
  let app: express.Express;

  beforeEach(async () => {
    const logger = mockServices.logger.mock();
    const providerManager = new ProviderManager(logger);
    const mockDb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue(undefined),
    } as any;
    const usageTracker = new UsageTracker(mockDb);

    const router = createRouter({
      events: { publish: jest.fn() } as any,
      providerManager,
      usageTracker,
      httpAuth: mockServices.httpAuth(),
      permissions: mockServices.permissions(),
      logger,
      config: mockServices.rootConfig(),
    });

    app = express();
    app.use(router);
  });

  it('returns empty providers list', async () => {
    const res = await request(app).get('/providers');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns empty models list', async () => {
    const res = await request(app).get('/models');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('rejects chat when no provider is registered', async () => {
    const res = await request(app)
      .post('/chat')
      .set('Authorization', mockCredentials.user.header())
      .send({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(500);
  });
});
