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

import OpenAI from 'openai';
import { LoggerService } from '@backstage/backend-plugin-api';
import { AiProvider } from '@backstage/plugin-ai-gateway-node';
import {
  AiChatChunk,
  AiChatRequest,
  AiChatResponse,
  AiModel,
  AiProviderCapabilities,
} from '@backstage/plugin-ai-gateway-common';

/** Configuration required to construct an {@link OpenAiProvider}. */
export interface OpenAiProviderOptions {
  apiKey: string;
  organization?: string;
  baseUrl?: string;
}

const KNOWN_MODELS: AiModel[] = [
  {
    id: 'gpt-4o',
    providerId: 'openai',
    name: 'GPT-4o',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      toolUse: true,
      maxContextTokens: 128000,
      maxOutputTokens: 16384,
    },
  },
  {
    id: 'gpt-4o-mini',
    providerId: 'openai',
    name: 'GPT-4o Mini',
    capabilities: {
      chat: true,
      streaming: true,
      vision: false,
      toolUse: true,
      maxContextTokens: 128000,
      maxOutputTokens: 16384,
    },
  },
];

/**
 * {@link AiProvider} implementation backed by the OpenAI Chat Completions
 * API.
 *
 * The actual network calls to the OpenAI SDK are routing placeholders —
 * they establish the request/response shape translation between the AI
 * Gateway's provider-neutral types and the OpenAI client, but are not
 * exercised against a live API in this module.
 */
export class OpenAiProvider implements AiProvider {
  readonly providerId = 'openai';

  private readonly client: OpenAI;

  private constructor(
    options: OpenAiProviderOptions,
    private readonly logger: LoggerService,
  ) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      organization: options.organization,
      baseURL: options.baseUrl,
    });
  }

  static create(
    options: OpenAiProviderOptions,
    logger: LoggerService,
  ): OpenAiProvider {
    return new OpenAiProvider(options, logger);
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    this.logger.debug(
      `Sending chat request to OpenAI model ${request.modelId}`,
    );

    const response = await this.client.chat.completions.create({
      model: request.modelId,
      messages: request.messages.map(message => ({
        role: message.role,
        content: message.content,
      })),
      max_tokens: request.maxTokens,
      temperature: request.temperature,
    });

    const choice = response.choices[0];

    return {
      content: choice?.message?.content ?? '',
      modelId: request.modelId,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
    };
  }

  async *chatStream(request: AiChatRequest): AsyncIterable<AiChatChunk> {
    const stream = await this.client.chat.completions.create({
      model: request.modelId,
      messages: request.messages.map(message => ({
        role: message.role,
        content: message.content,
      })),
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: true,
    });

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const delta = choice?.delta?.content ?? '';
      const done =
        choice?.finish_reason !== null && choice?.finish_reason !== undefined;

      yield {
        delta,
        done,
        usage: done
          ? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
          : undefined,
      };
    }
  }

  async listModels(): Promise<AiModel[]> {
    return KNOWN_MODELS;
  }

  getCapabilities(): AiProviderCapabilities {
    return {
      providerId: this.providerId,
      displayName: 'OpenAI',
      supportedModels: KNOWN_MODELS,
    };
  }
}
