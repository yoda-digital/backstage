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

import Anthropic from '@anthropic-ai/sdk';
import { LoggerService } from '@backstage/backend-plugin-api';
import { AiProvider } from '@backstage/plugin-ai-gateway-node';
import {
  AiChatChunk,
  AiChatRequest,
  AiChatResponse,
  AiModel,
  AiProviderCapabilities,
} from '@backstage/plugin-ai-gateway-common';

/** Configuration required to construct an {@link AnthropicProvider}. */
export interface AnthropicProviderOptions {
  apiKey: string;
  baseUrl?: string;
}

const KNOWN_MODELS: AiModel[] = [
  {
    id: 'claude-sonnet-4-20250514',
    providerId: 'anthropic',
    name: 'Claude Sonnet 4',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      toolUse: true,
      maxContextTokens: 200000,
      maxOutputTokens: 64000,
    },
  },
  {
    id: 'claude-opus-4-20250514',
    providerId: 'anthropic',
    name: 'Claude Opus 4',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      toolUse: true,
      maxContextTokens: 200000,
      maxOutputTokens: 32000,
    },
  },
  {
    id: 'claude-haiku-3-5-20241022',
    providerId: 'anthropic',
    name: 'Claude 3.5 Haiku',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      toolUse: true,
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
    },
  },
];

/**
 * {@link AiProvider} implementation backed by the Anthropic Messages API.
 *
 * The actual network calls to the Anthropic SDK are routing placeholders —
 * they establish the request/response shape translation between the AI
 * Gateway's provider-neutral types and the Anthropic client, but are not
 * exercised against a live API in this module.
 */
export class AnthropicProvider implements AiProvider {
  readonly providerId = 'anthropic';

  private readonly client: Anthropic;

  private constructor(
    options: AnthropicProviderOptions,
    private readonly logger: LoggerService,
  ) {
    this.client = new Anthropic({
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
    });
  }

  static create(
    options: AnthropicProviderOptions,
    logger: LoggerService,
  ): AnthropicProvider {
    return new AnthropicProvider(options, logger);
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    this.logger.debug(
      `Sending chat request to Anthropic model ${request.modelId}`,
    );

    const messages = request.messages
      .filter(message => message.role !== 'system')
      .map(message => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      }));

    const response = await this.client.messages.create({
      model: request.modelId,
      max_tokens: request.maxTokens ?? 4096,
      system: request.system,
      messages,
      temperature: request.temperature,
    });

    const content = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    return {
      content,
      modelId: request.modelId,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async *chatStream(request: AiChatRequest): AsyncIterable<AiChatChunk> {
    const messages = request.messages
      .filter(message => message.role !== 'system')
      .map(message => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      }));

    const stream = this.client.messages.stream({
      model: request.modelId,
      max_tokens: request.maxTokens ?? 4096,
      system: request.system,
      messages,
      temperature: request.temperature,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield { delta: event.delta.text, done: false };
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      delta: '',
      done: true,
      usage: {
        promptTokens: finalMessage.usage.input_tokens,
        completionTokens: finalMessage.usage.output_tokens,
        totalTokens:
          finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
      },
    };
  }

  async listModels(): Promise<AiModel[]> {
    return KNOWN_MODELS;
  }

  getCapabilities(): AiProviderCapabilities {
    return {
      providerId: this.providerId,
      displayName: 'Anthropic',
      supportedModels: KNOWN_MODELS,
    };
  }
}
