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

export interface Config {
  aiAssistant?: {
    /**
     * Default mode used for new conversations when none is specified.
     */
    defaultMode?: string;
    /**
     * Default model id used to serve assistant conversations.
     */
    defaultModel?: string;
    /**
     * Custom assistant modes, in addition to the built-in modes.
     */
    modes?: Array<{
      id: string;
      name: string;
      description: string;
      systemPrompt: string;
      knowledgeSources: string[];
      modelId?: string;
    }>;
  };
}
