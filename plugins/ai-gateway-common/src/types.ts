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

/** A single message in a chat conversation with an AI model. */
export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** A request to a chat-capable AI model. */
export interface AiChatRequest {
  /** Target model id, e.g. "claude-sonnet-4-20250514" */
  modelId: string;
  /** Conversation messages */
  messages: AiChatMessage[];
  /** Optional system prompt */
  system?: string;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Temperature 0-1 */
  temperature?: number;
  /** Whether to stream the response */
  stream?: boolean;
}

/** A single chunk in a streaming chat response. */
export interface AiChatChunk {
  /** The text delta */
  delta: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Usage info, present only on the final chunk */
  usage?: AiTokenUsage;
}

/** Non-streaming chat response. */
export interface AiChatResponse {
  content: string;
  modelId: string;
  usage: AiTokenUsage;
}

/** Token usage for a single chat request. */
export interface AiTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** A model exposed by an AI provider. */
export interface AiModel {
  id: string;
  providerId: string;
  name: string;
  capabilities: AiModelCapabilities;
}

/** Capabilities supported by a given AI model. */
export interface AiModelCapabilities {
  chat: boolean;
  streaming: boolean;
  vision: boolean;
  toolUse: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
}

/** Capability metadata for an AI provider. */
export interface AiProviderCapabilities {
  providerId: string;
  displayName: string;
  supportedModels: AiModel[];
}

/** Runtime status information for an AI provider. */
export interface AiProviderInfo {
  providerId: string;
  displayName: string;
  status: 'connected' | 'disconnected' | 'error';
  modelCount: number;
}

/** A single recorded usage event for billing and auditing. */
export interface AiUsageRecord {
  id: string;
  providerId: string;
  modelId: string;
  userEntityRef: string;
  promptTokens: number;
  completionTokens: number;
  timestamp: string;
}

/** Query options for filtering usage records. */
export interface AiUsageQuery {
  providerId?: string;
  modelId?: string;
  userEntityRef?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/** Aggregated usage summary, optionally scoped by a query. */
export interface AiUsageSummary {
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  byProvider: Record<
    string,
    { requests: number; promptTokens: number; completionTokens: number }
  >;
  byModel: Record<
    string,
    { requests: number; promptTokens: number; completionTokens: number }
  >;
}
