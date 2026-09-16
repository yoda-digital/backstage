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

import { mockServices } from '@backstage/backend-test-utils';
import { AiMode } from '@backstage/plugin-ai-assistant-common';
import { ProcessorPipeline } from './ProcessorPipeline';
import { AiGatewayClient } from './AiGatewayClient';

function buildMode(processors: AiMode['processors']): AiMode {
  return {
    id: 'mode-1',
    name: 'Test mode',
    description: 'desc',
    instructions: 'You are a helpful assistant.',
    visibility: 'private',
    ownerRef: 'user:default/alice',
    processors,
    usageCount30d: 0,
    createdAt: '',
    updatedAt: '',
  };
}

describe('ProcessorPipeline', () => {
  it('runs only the main model call when all processors are disabled', async () => {
    const chat = jest.fn().mockResolvedValue({
      content: 'the answer',
      modelId: 'claude-sonnet-4-20250514',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });
    const gatewayClient = { chat } as unknown as AiGatewayClient;
    const pipeline = ProcessorPipeline.create({
      gatewayClient,
      logger: mockServices.logger.mock(),
    });

    const result = await pipeline.run({
      mode: buildMode([]),
      history: [],
      userMessage: 'How do I deploy this service?',
      defaultModel: 'claude-sonnet-4-20250514',
    });

    expect(chat).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      content: 'the answer',
      classification: undefined,
      plan: undefined,
      confidence: 'medium',
    });
  });

  it('runs classification, planning, and confidence-scoring when enabled', async () => {
    const chat = jest
      .fn()
      .mockResolvedValueOnce({ content: 'how-to' }) // classification
      .mockResolvedValueOnce({
        content: '1. Look up the service\n2. Deploy it',
      }) // planning
      .mockResolvedValueOnce({ content: 'Here is how to deploy it.' }) // main call
      .mockResolvedValueOnce({ content: 'high' }); // confidence-scoring
    const gatewayClient = { chat } as unknown as AiGatewayClient;
    const pipeline = ProcessorPipeline.create({
      gatewayClient,
      logger: mockServices.logger.mock(),
    });

    const result = await pipeline.run({
      mode: buildMode([
        { type: 'classification', enabled: true },
        { type: 'planning', enabled: true },
        { type: 'confidence-scoring', enabled: true },
      ]),
      history: [],
      userMessage: 'How do I deploy this service?',
      defaultModel: 'claude-sonnet-4-20250514',
    });

    expect(chat).toHaveBeenCalledTimes(4);
    expect(result.classification).toBe('how-to');
    expect(result.plan).toContain('Deploy it');
    expect(result.content).toBe('Here is how to deploy it.');
    expect(result.confidence).toBe('high');
  });

  it('retries the main answer when verification asks for a revision', async () => {
    const chat = jest
      .fn()
      .mockResolvedValueOnce({ content: 'first draft' }) // main call
      .mockResolvedValueOnce({ content: 'Missing the rollback steps' }) // verification: needs work
      .mockResolvedValueOnce({ content: 'revised answer' }) // revision
      .mockResolvedValueOnce({ content: 'OK' }); // verification: passes
    const gatewayClient = { chat } as unknown as AiGatewayClient;
    const pipeline = ProcessorPipeline.create({
      gatewayClient,
      logger: mockServices.logger.mock(),
    });

    const result = await pipeline.run({
      mode: buildMode([{ type: 'verification', enabled: true }]),
      history: [],
      userMessage: 'How do I roll back a deployment?',
      defaultModel: 'claude-sonnet-4-20250514',
    });

    expect(chat).toHaveBeenCalledTimes(4);
    expect(result.content).toBe('revised answer');
  });

  it('uses a processor-specific model override when configured', async () => {
    const chat = jest
      .fn()
      .mockResolvedValueOnce({ content: 'lookup' })
      .mockResolvedValueOnce({ content: 'answer' });
    const gatewayClient = { chat } as unknown as AiGatewayClient;
    const pipeline = ProcessorPipeline.create({
      gatewayClient,
      logger: mockServices.logger.mock(),
    });

    await pipeline.run({
      mode: buildMode([
        {
          type: 'classification',
          enabled: true,
          modelId: 'claude-haiku-4-20250514',
        },
      ]),
      history: [],
      userMessage: 'What is the on-call schedule?',
      defaultModel: 'claude-sonnet-4-20250514',
    });

    expect(chat.mock.calls[0][0]).toMatchObject({
      modelId: 'claude-haiku-4-20250514',
    });
    expect(chat.mock.calls[1][0]).toMatchObject({
      modelId: 'claude-sonnet-4-20250514',
    });
  });
});
