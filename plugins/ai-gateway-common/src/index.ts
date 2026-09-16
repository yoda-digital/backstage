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

/**
 * Common types and utilities for the ai-gateway plugin.
 *
 * @packageDocumentation
 */

export {
  type AiChatRequest,
  type AiChatMessage,
  type AiChatChunk,
  type AiChatResponse,
  type AiTokenUsage,
  type AiModel,
  type AiModelCapabilities,
  type AiProviderCapabilities,
  type AiProviderInfo,
  type AiUsageRecord,
  type AiUsageQuery,
  type AiUsageSummary,
} from './types';
export { MODEL_CAPABILITY_PRESETS } from './models';
export {
  AI_GATEWAY_RESOURCE_TYPE,
  aiGatewayAdminPermission,
  aiGatewayChatPermission,
  aiGatewayUsageReadPermission,
  aiGatewayPermissions,
} from './permissions';
