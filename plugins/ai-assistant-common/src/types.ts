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

/** A conversation between a user and the AI assistant. */
export interface AiConversation {
  id: string;
  title: string;
  modeId: string;
  userEntityRef: string;
  messages: AiAssistantMessage[];
  createdAt: string;
  updatedAt: string;
}

/** A single message within an AI assistant conversation. */
export interface AiAssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: KnowledgeChunk[];
  /** Confidence rating produced by the confidence-scoring processor, if enabled. */
  confidence?: 'low' | 'medium' | 'high';
  /** Request classification produced by the classification processor, if enabled. */
  classification?: string;
  timestamp: string;
}

/** A configurable assistant mode, e.g. "Onboarding" or "Incident response". */
export interface AiAssistantMode {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  knowledgeSources: string[];
  modelId?: string;
  icon?: string;
}

/** A chunk of content retrieved from a knowledge source. */
export interface KnowledgeChunk {
  sourceId: string;
  content: string;
  metadata: Record<string, string>;
  score: number;
}

/** Options controlling a knowledge source search. */
export interface KnowledgeSearchOptions {
  maxResults?: number;
  minScore?: number;
  entityRef?: string;
}

/** Query options for filtering conversations. */
export interface ConversationQuery {
  userEntityRef?: string;
  modeId?: string;
  limit?: number;
  offset?: number;
}

/** Request payload for creating a new conversation. */
export interface CreateConversationRequest {
  title?: string;
  modeId: string;
}

/** Request payload for sending a message within a conversation. */
export interface SendMessageRequest {
  content: string;
  stream?: boolean;
  /**
   * Id of an {@link AiMode} to use for this message. When set, the message is
   * routed through the mode's processor pipeline instead of the default
   * conversation flow.
   */
  modeId?: string;
  /** Context describing the page the user was on when sending the message. */
  pageContext?: PageContext;
}

/**
 * Context describing the frontend page a user was viewing when interacting
 * with the AiKA assistant, captured from the DOM/route and sent with each
 * message so responses can be tailored to what the user is looking at.
 */
export interface PageContext {
  route: string;
  entityRef?: string;
  entityKind?: string;
  entityType?: string;
  techDocsPath?: string;
  pageTitle: string;
}

/** A contextual quick-action suggestion shown above the AiKA input. */
export interface AiSuggestion {
  id: string;
  label: string;
  prompt: string;
}

/** The six processor types that make up a mode's processor pipeline. */
export type AiProcessorType =
  | 'context-management'
  | 'classification'
  | 'planning'
  | 'answer-formatting'
  | 'verification'
  | 'confidence-scoring';

/** All processor types, in pipeline execution order. */
export const ALL_PROCESSOR_TYPES: AiProcessorType[] = [
  'context-management',
  'classification',
  'planning',
  'answer-formatting',
  'verification',
  'confidence-scoring',
];

/** Configuration for a single processor within a mode's pipeline. */
export interface AiProcessor {
  type: AiProcessorType;
  enabled: boolean;
  /** Optional model override used only for this processor's own calls. */
  modelId?: string;
}

/** Visibility of a mode: usable only by its owner, or by anyone. */
export type AiModeVisibility = 'private' | 'public';

/**
 * A configurable AiKA mode: instructions, tool access, and a processor
 * pipeline that runs before/after each AI Gateway call.
 */
export interface AiMode {
  id: string;
  name: string;
  description: string;
  instructions: string;
  visibility: AiModeVisibility;
  ownerRef: string;
  processors: AiProcessor[];
  mcpTools?: string[];
  modelOverride?: string;
  maxSteps?: number;
  temperature?: number;
  /** Number of times the mode was used across all conversations in the last 30 days. */
  usageCount30d: number;
  /** True for the built-in modes ('general', 'catalog-expert'), which cannot be edited or deleted. */
  builtIn?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Request payload for creating a new {@link AiMode}. */
export interface CreateModeRequest {
  name: string;
  description: string;
  instructions: string;
  visibility: AiModeVisibility;
  processors?: AiProcessor[];
  mcpTools?: string[];
  modelOverride?: string;
  maxSteps?: number;
  temperature?: number;
}

/** Request payload for updating an existing {@link AiMode}. */
export type UpdateModeRequest = Partial<CreateModeRequest>;
