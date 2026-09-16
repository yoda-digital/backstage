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
  AiChatRequest,
  AiChatChunk,
  AiChatResponse,
  AiModel,
  AiProviderCapabilities,
} from '@backstage/plugin-ai-gateway-common';

/** Interface that AI provider modules must implement. */
export interface AiProvider {
  /** Unique provider identifier, e.g. 'anthropic', 'openai' */
  readonly providerId: string;

  /** Send a chat request and get a non-streaming response */
  chat(request: AiChatRequest): Promise<AiChatResponse>;

  /** Send a chat request and stream response chunks */
  chatStream(request: AiChatRequest): AsyncIterable<AiChatChunk>;

  /** List models available from this provider */
  listModels(): Promise<AiModel[]>;

  /** Get provider capability metadata */
  getCapabilities(): AiProviderCapabilities;
}
