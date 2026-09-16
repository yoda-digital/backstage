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

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { LoggerService } from '@backstage/backend-plugin-api';
import { AiProvider } from '@backstage/plugin-ai-gateway-node';
import {
  AiChatChunk,
  AiChatRequest,
  AiChatResponse,
  AiModel,
  AiProviderCapabilities,
} from '@backstage/plugin-ai-gateway-common';

/** Configuration required to construct a {@link BedrockProvider}. */
export interface BedrockProviderOptions {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

const KNOWN_MODELS: AiModel[] = [
  {
    id: 'anthropic.claude-sonnet-4-20250514-v1:0',
    providerId: 'bedrock',
    name: 'Claude Sonnet 4 (Bedrock)',
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
    id: 'anthropic.claude-haiku-3-5-20241022-v1:0',
    providerId: 'bedrock',
    name: 'Claude 3.5 Haiku (Bedrock)',
    capabilities: {
      chat: true,
      streaming: true,
      vision: true,
      toolUse: true,
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
    },
  },
  {
    id: 'amazon.titan-text-express-v1',
    providerId: 'bedrock',
    name: 'Amazon Titan Text Express',
    capabilities: {
      chat: true,
      streaming: true,
      vision: false,
      toolUse: false,
      maxContextTokens: 8000,
      maxOutputTokens: 8000,
    },
  },
];

/**
 * {@link AiProvider} implementation backed by AWS Bedrock's runtime API,
 * targeting `anthropic.claude-*` and `amazon.titan-*` model families.
 *
 * The actual network calls to the AWS SDK are routing placeholders — they
 * establish the request/response shape translation between the AI
 * Gateway's provider-neutral types and the Bedrock runtime client, but are
 * not exercised against a live API in this module.
 */
export class BedrockProvider implements AiProvider {
  readonly providerId = 'bedrock';

  private readonly client: BedrockRuntimeClient;

  private constructor(
    options: BedrockProviderOptions,
    private readonly logger: LoggerService,
  ) {
    this.client = new BedrockRuntimeClient({
      region: options.region,
      ...(options.accessKeyId && options.secretAccessKey
        ? {
            credentials: {
              accessKeyId: options.accessKeyId,
              secretAccessKey: options.secretAccessKey,
            },
          }
        : {}),
    });
  }

  static create(
    options: BedrockProviderOptions,
    logger: LoggerService,
  ): BedrockProvider {
    return new BedrockProvider(options, logger);
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    this.logger.debug(
      `Sending chat request to Bedrock model ${request.modelId}`,
    );

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: request.maxTokens ?? 4096,
      system: request.system,
      messages: request.messages
        .filter(message => message.role !== 'system')
        .map(message => ({ role: message.role, content: message.content })),
    });

    const command = new InvokeModelCommand({
      modelId: request.modelId,
      body: new TextEncoder().encode(body),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await this.client.send(command);
    const parsed = JSON.parse(new TextDecoder().decode(response.body));

    return {
      content: parsed.content?.[0]?.text ?? '',
      modelId: request.modelId,
      usage: {
        promptTokens: parsed.usage?.input_tokens ?? 0,
        completionTokens: parsed.usage?.output_tokens ?? 0,
        totalTokens:
          (parsed.usage?.input_tokens ?? 0) +
          (parsed.usage?.output_tokens ?? 0),
      },
    };
  }

  async *chatStream(request: AiChatRequest): AsyncIterable<AiChatChunk> {
    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: request.maxTokens ?? 4096,
      system: request.system,
      messages: request.messages
        .filter(message => message.role !== 'system')
        .map(message => ({ role: message.role, content: message.content })),
    });

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: request.modelId,
      body: new TextEncoder().encode(body),
      contentType: 'application/json',
    });

    const response = await this.client.send(command);
    if (!response.body) {
      return;
    }

    for await (const event of response.body) {
      if (!event.chunk?.bytes) {
        continue;
      }

      const parsed = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

      if (parsed.type === 'content_block_delta') {
        yield { delta: parsed.delta?.text ?? '', done: false };
      } else if (parsed.type === 'message_stop') {
        yield {
          delta: '',
          done: true,
          usage: {
            promptTokens: parsed.usage?.input_tokens ?? 0,
            completionTokens: parsed.usage?.output_tokens ?? 0,
            totalTokens:
              (parsed.usage?.input_tokens ?? 0) +
              (parsed.usage?.output_tokens ?? 0),
          },
        };
      }
    }
  }

  async listModels(): Promise<AiModel[]> {
    return KNOWN_MODELS;
  }

  getCapabilities(): AiProviderCapabilities {
    return {
      providerId: this.providerId,
      displayName: 'AWS Bedrock',
      supportedModels: KNOWN_MODELS,
    };
  }
}
