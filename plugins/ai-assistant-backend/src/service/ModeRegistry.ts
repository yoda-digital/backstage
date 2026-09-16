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

import { Config } from '@backstage/config';
import { AiAssistantMode } from '@backstage/plugin-ai-assistant-common';

const BUILT_IN_MODES: AiAssistantMode[] = [
  {
    id: 'general',
    name: 'General Assistant',
    description: 'General-purpose developer assistant',
    systemPrompt:
      'You are a helpful developer portal assistant. Answer questions about the organization, its services, and development practices.',
    knowledgeSources: ['catalog', 'techdocs'],
  },
  {
    id: 'catalog-expert',
    name: 'Catalog Expert',
    description: 'Expert on catalog entities, ownership, and dependencies',
    systemPrompt:
      'You are an expert on the software catalog. Help users understand service ownership, dependencies, APIs, and component relationships.',
    knowledgeSources: ['catalog'],
  },
];

/**
 * Holds the built-in and configured AI assistant modes.
 *
 * @internal
 */
export class ModeRegistry {
  private readonly modes = new Map<string, AiAssistantMode>();

  constructor(config: Config) {
    for (const mode of BUILT_IN_MODES) {
      this.modes.set(mode.id, mode);
    }

    const customModes =
      config.getOptionalConfigArray('aiAssistant.modes') ?? [];
    for (const modeConfig of customModes) {
      const mode: AiAssistantMode = {
        id: modeConfig.getString('id'),
        name: modeConfig.getString('name'),
        description: modeConfig.getString('description'),
        systemPrompt: modeConfig.getString('systemPrompt'),
        knowledgeSources: modeConfig.getStringArray('knowledgeSources'),
        modelId: modeConfig.getOptionalString('modelId'),
      };
      this.modes.set(mode.id, mode);
    }
  }

  getMode(id: string): AiAssistantMode | undefined {
    return this.modes.get(id);
  }

  listModes(): AiAssistantMode[] {
    return [...this.modes.values()];
  }
}
