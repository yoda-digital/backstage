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
import { matchPath, useLocation } from 'react-router-dom';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { PageContext } from '@backstage/plugin-ai-assistant-common';

const ENTITY_PATH_PATTERNS = [
  '/catalog/:namespace/:kind/:name/*',
  '/catalog/:namespace/:kind/:name',
];

const TECH_DOCS_PATH_PATTERNS = [
  '/docs/:namespace/:kind/:name/*',
  '/docs/:namespace/:kind/:name',
];

function matchFirst(
  patterns: string[],
  pathname: string,
): Record<string, string | undefined> | undefined {
  for (const pattern of patterns) {
    const match = matchPath(pattern, pathname);
    if (match) {
      return match.params;
    }
  }
  return undefined;
}

/**
 * Captures the AiKA {@link PageContext} for the page the user is currently
 * viewing: its route, the catalog entity it belongs to (if any, derived from
 * the URL rather than `useEntity` so this hook is safe to call from the
 * app-root AiKA panel, which is mounted outside of any `EntityProvider`),
 * the TechDocs page path (if on a docs page), and the document title.
 *
 * @public
 */
export function usePageContext(): PageContext {
  const location = useLocation();
  const { pathname } = location;

  return useMemo(() => {
    const context: PageContext = {
      route: pathname,
      pageTitle: typeof document !== 'undefined' ? document.title : '',
    };

    const entityMatch = matchFirst(ENTITY_PATH_PATTERNS, pathname);
    if (entityMatch?.kind && entityMatch?.name) {
      context.entityRef = stringifyEntityRef({
        kind: entityMatch.kind,
        namespace: entityMatch.namespace ?? 'default',
        name: entityMatch.name,
      });
      context.entityKind = entityMatch.kind;
    }

    const docsMatch = matchFirst(TECH_DOCS_PATH_PATTERNS, pathname);
    if (docsMatch?.kind && docsMatch?.name) {
      context.techDocsPath = pathname;
      if (!context.entityRef) {
        context.entityRef = stringifyEntityRef({
          kind: docsMatch.kind,
          namespace: docsMatch.namespace ?? 'default',
          name: docsMatch.name,
        });
        context.entityKind = docsMatch.kind;
      }
    }

    return context;
  }, [pathname]);
}
