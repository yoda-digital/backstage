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
import { RuleStore } from './RuleStore';
import { SkillStore } from './SkillStore';
import { PluginStore } from './PluginStore';

describe('createRouter', () => {
  let app: express.Express;

  beforeEach(async () => {
    const logger = mockServices.logger.mock();
    const config = mockServices.rootConfig();
    const queryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      first: jest.fn().mockResolvedValue(undefined),
      then: (resolve: (rows: unknown[]) => unknown) => resolve([]),
    };
    const mockDb = jest.fn().mockReturnValue(queryBuilder) as any;

    const ruleStore = new RuleStore(mockDb);
    const skillStore = new SkillStore(mockDb);
    const pluginStore = new PluginStore(mockDb);

    const router = createRouter({
      events: { publish: jest.fn() } as any,
      ruleStore,
      skillStore,
      pluginStore,
      httpAuth: mockServices.httpAuth(),
      logger,
      config,
    });

    app = express();
    app.use(router);
  });

  it('returns an empty rules list', async () => {
    const res = await request(app)
      .get('/rules')
      .set('Authorization', mockCredentials.user.header());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('creates a rule for an authenticated user', async () => {
    const res = await request(app)
      .post('/rules')
      .set('Authorization', mockCredentials.user.header())
      .send({
        name: 'Block secrets',
        description: 'Blocks prompts containing secrets',
        type: 'input-filter',
        enabled: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Block secrets');
  });

  it('returns an empty plugins list without auth', async () => {
    const res = await request(app).get('/plugins');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
