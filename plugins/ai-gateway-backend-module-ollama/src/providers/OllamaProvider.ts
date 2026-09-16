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

import { LoggerService } from '@backstage/backend-plugin-api';
import { AiProvider } from '@backstage/plugin-ai-gateway-node';
import {
  AiChatChunk,
  AiChatRequest,
  AiChatResponse,
  AiModel,
  AiProviderCapabilities,
} from '@backstage/plugin-ai-gateway-common';

/** Configuration required to construct an {@link OllamaProvider}. */
export interface OllamaProviderOptions {
  baseUrl: string;
}

interface OllamaTagsResponseModel {
  name: string;
  details?: {
    context_length?: number;
  };
}

/**
 * {@link AiProvider} implementation backed by a self-hosted Ollama server's
 * HTTP API.
 *
 * The actual network calls against the Ollama HTTP API are routing
 * placeholders — they establish the request/response shape translation
 * between the AI Gateway's provider-neutral types and Ollama's native API,
 * but are not exercised against a live server in this module.
 */
export class OllamaProvider implements AiProvider {
  readonly providerId = 'ollama';

  private constructor(
    private readonly options: OllamaProviderOptions,
    private readonly logger: LoggerService,
  ) {}

  static create(
    options: OllamaProviderOptions,
    logger: LoggerService,
  ): OllamaProvider {
    return new OllamaProvider(options, logger);
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    this.logger.debug(
      `Sending chat request to Ollama model ${request.modelId}`,
    );

    const response = await fetch(`${this.options.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.modelId,
        messages: request.messages.map(message => ({
          role: message.role,
          content: message.content,
        })),
        stream: false,
      }),
    });
    const data = await response.json();

    return {
      content: data.message?.content ?? '',
      modelId: request.modelId,
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
    };
  }

  async *chatStream(request: AiChatRequest): AsyncIterable<AiChatChunk> {
    const response = await fetch(`${this.options.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.modelId,
        messages: request.messages.map(message => ({
          role: message.role,
          content: message.content,
        })),
        stream: true,
      }),
    });

    if (!response.body) {
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done: readerDone, value } = await reader.read();
      if (readerDone) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const parsed = JSON.parse(line);
        yield {
          delta: parsed.message?.content ?? '',
          done: parsed.done ?? false,
          usage: parsed.done
            ? {
                promptTokens: parsed.prompt_eval_count ?? 0,
                completionTokens: parsed.eval_count ?? 0,
                totalTokens:
                  (parsed.prompt_eval_count ?? 0) + (parsed.eval_count ?? 0),
              }
            : undefined,
        };
      }
    }
  }

  async listModels(): Promise<AiModel[]> {
    const response = await fetch(`${this.options.baseUrl}/api/tags`);
    const data = await response.json();
    const models: OllamaTagsResponseModel[] = data.models ?? [];

    return models.map(model => ({
      id: model.name,
      providerId: this.providerId,
      name: model.name,
      capabilities: {
        chat: true,
        streaming: true,
        vision: false,
        toolUse: false,
        maxContextTokens: model.details?.context_length ?? 4096,
        maxOutputTokens: model.details?.context_length ?? 4096,
      },
    }));
  }

  getCapabilities(): AiProviderCapabilities {
    return {
      providerId: this.providerId,
      displayName: 'Ollama (Self-hosted)',
      supportedModels: [],
    };
  }
}
