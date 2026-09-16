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
import { ConversationStore } from './ConversationStore';
import { ModeRegistry } from './ModeRegistry';
import { ModeStore } from './ModeStore';
import { ProcessorPipeline } from './ProcessorPipeline';
import { SuggestionRegistry } from './SuggestionRegistry';
import { RagPipeline } from './RagPipeline';
import { KnowledgeSourceManager } from './KnowledgeSourceManager';
import { AiGatewayClient } from './AiGatewayClient';

describe('createRouter', () => {
  let app: express.Express;
  let gatewayClient: { chat: jest.Mock };

  beforeEach(async () => {
    const logger = mockServices.logger.mock();
    const config = mockServices.rootConfig();
    const modeRegistry = new ModeRegistry(config);
    const knowledgeSourceManager = new KnowledgeSourceManager(logger);
    const ragPipeline = new RagPipeline(knowledgeSourceManager, logger);
    const suggestionRegistry = new SuggestionRegistry(logger);

    const queryBuilder: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      first: jest.fn().mockResolvedValue(undefined),
      then: (resolve: (rows: unknown[]) => unknown) => resolve([]),
    };
    const mockDb = jest.fn().mockReturnValue(queryBuilder) as any;
    const conversationStore = new ConversationStore(mockDb);
    const modeStore = ModeStore.create(mockDb);

    gatewayClient = { chat: jest.fn() };
    const processorPipeline = ProcessorPipeline.create({
      gatewayClient: gatewayClient as unknown as AiGatewayClient,
      logger,
    });

    const router = createRouter({
      events: { publish: jest.fn() } as any,
      conversationStore,
      modeRegistry,
      modeStore,
      processorPipeline,
      suggestionRegistry,
      ragPipeline,
      gatewayClient: gatewayClient as unknown as AiGatewayClient,
      httpAuth: mockServices.httpAuth(),
      permissions: mockServices.permissions(),
      logger,
      config,
      defaultModel: 'claude-sonnet-4-20250514',
    });

    app = express();
    app.use(router);
  });

  it('returns the built-in modes', async () => {
    const res = await request(app).get('/modes');
    expect(res.status).toBe(200);
    expect(res.body.map((m: { id: string }) => m.id)).toEqual(
      expect.arrayContaining(['general', 'catalog-expert']),
    );
    expect(
      res.body.find((m: { id: string }) => m.id === 'general').builtIn,
    ).toBe(true);
  });

  it('returns an empty popular modes list when nothing has been used yet', async () => {
    const res = await request(app).get('/modes/popular');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('rejects creating a mode without a name, instructions, or visibility', async () => {
    const res = await request(app)
      .post('/modes')
      .set('Authorization', mockCredentials.user.header())
      .send({ name: 'x' });
    expect(res.status).toBe(400);
  });

  it('creates a mode owned by the authenticated user', async () => {
    const res = await request(app)
      .post('/modes')
      .set('Authorization', mockCredentials.user.header())
      .send({
        name: 'Incident Responder',
        description: 'Helps triage incidents',
        instructions: 'Be concise.',
        visibility: 'private',
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Incident Responder');
    expect(res.body.usageCount30d).toBe(0);
  });

  it('creates a conversation for an authenticated user', async () => {
    const res = await request(app)
      .post('/conversations')
      .set('Authorization', mockCredentials.user.header())
      .send({ modeId: 'general', title: 'Test' });
    expect(res.status).toBe(201);
    expect(res.body.modeId).toBe('general');
  });

  it('returns 404 for a missing conversation', async () => {
    const res = await request(app)
      .get('/conversations/does-not-exist')
      .set('Authorization', mockCredentials.user.header());
    expect(res.status).toBe(404);
  });
});
