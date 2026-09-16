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

import { useMemo } from 'react';
import {
  AiSuggestion,
  PageContext,
} from '@backstage/plugin-ai-assistant-common';

const DEFAULT_SUGGESTION: AiSuggestion[] = [
  {
    id: 'default',
    label: 'What can you help me with?',
    prompt: 'What can you help me with?',
  },
];

const ENTITY_SUGGESTIONS: AiSuggestion[] = [
  {
    id: 'entity-summarize',
    label: 'Summarize this component',
    prompt: 'Summarize this component.',
  },
  {
    id: 'entity-soundcheck',
    label: 'Show Soundcheck status',
    prompt: 'Show the Soundcheck status for this component.',
  },
  {
    id: 'entity-changes',
    label: 'List recent changes',
    prompt: 'List recent changes to this component.',
  },
];

const TECH_DOCS_SUGGESTIONS: AiSuggestion[] = [
  {
    id: 'docs-summarize',
    label: 'Summarize this page',
    prompt: 'Summarize this documentation page.',
  },
  {
    id: 'docs-related',
    label: 'Find related documentation',
    prompt: 'Find documentation related to this page.',
  },
];

const SOUNDCHECK_SUGGESTIONS: AiSuggestion[] = [
  {
    id: 'soundcheck-explain',
    label: 'Explain failing checks',
    prompt: 'Explain the failing Soundcheck checks for this entity.',
  },
  {
    id: 'soundcheck-fixes',
    label: 'Suggest fixes for this entity',
    prompt: 'Suggest fixes for the failing Soundcheck checks on this entity.',
  },
];

const CATALOG_SUGGESTIONS: AiSuggestion[] = [
  {
    id: 'catalog-owned',
    label: 'Find services owned by my team',
    prompt: 'Find services owned by my team.',
  },
];

function isSoundcheckRoute(route: string): boolean {
  return route.includes('/soundcheck');
}

function suggestionsForContext(context: PageContext): AiSuggestion[] {
  if (isSoundcheckRoute(context.route)) {
    return SOUNDCHECK_SUGGESTIONS;
  }
  if (context.entityRef) {
    return ENTITY_SUGGESTIONS;
  }
  if (context.techDocsPath) {
    return TECH_DOCS_SUGGESTIONS;
  }
  if (context.route.startsWith('/catalog')) {
    return CATALOG_SUGGESTIONS;
  }
  return DEFAULT_SUGGESTION;
}

/**
 * Returns contextual AiKA suggestion chips for the given page, based on
 * hard-coded per-route defaults. Additional suggestions registered by other
 * plugins via `aiSuggestionsExtensionPoint` can be passed in `extra` (e.g.
 * fetched via `aiAssistantApiRef.getSuggestions`) and are appended after the
 * defaults.
 *
 * @public
 */
export function useSuggestions(
  context: PageContext,
  extra: AiSuggestion[] = [],
): AiSuggestion[] {
  return useMemo(
    () => [...suggestionsForContext(context), ...extra],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.route, context.entityRef, context.techDocsPath, extra],
  );
}
