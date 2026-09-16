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

/** A guardrail rule that governs AI behavior. */
export interface AiRule {
  id: string;
  name: string;
  description: string;
  type: 'input-filter' | 'output-filter' | 'rate-limit' | 'model-restriction';
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A reusable prompt skill/template. */
export interface AiSkill {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  variables: AiSkillVariable[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** A single templated variable used within an `AiSkill` prompt template. */
export interface AiSkillVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

/** An MCP plugin/server registration. */
export interface AiPlugin {
  id: string;
  name: string;
  description: string;
  serverUrl: string;
  transport: 'streamable-http' | 'sse' | 'stdio';
  tools: AiPluginTool[];
  enabled: boolean;
  createdAt: string;
}

/** A single tool exposed by an `AiPlugin` MCP server. */
export interface AiPluginTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Query options for filtering `AiRule` records. */
export interface AiRuleQuery {
  type?: AiRule['type'];
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

/** Query options for filtering `AiSkill` records. */
export interface AiSkillQuery {
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}
