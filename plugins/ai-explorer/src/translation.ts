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

import { createTranslationRef } from '@backstage/frontend-plugin-api';

/**
 * Translation strings for the AI Explorer plugin's UI.
 *
 * @public
 */
export const aiExplorerTranslationRef = createTranslationRef({
  id: 'ai-explorer',
  messages: {
    pluginsPage: {
      title: 'AI Plugins',
      subtitle: 'Manage MCP plugin integrations',
      tableTitle: 'Plugins',
    },
    rulesPage: {
      title: 'AI Rules',
      subtitle: 'Manage AI guardrails and policies',
      tableTitle: 'Rules',
    },
    skillsPage: {
      title: 'AI Skills',
      subtitle: 'Browse reusable prompt skills',
      tableTitle: 'Skills',
      searchLabel: 'Search skills',
    },
  },
});
