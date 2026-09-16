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

import { renderHook } from '@testing-library/react';
import { PageContext } from '@backstage/plugin-ai-assistant-common';
import { useSuggestions } from './useSuggestions';

function context(overrides: Partial<PageContext>): PageContext {
  return { route: '/', pageTitle: 'Test', ...overrides };
}

describe('useSuggestions', () => {
  it('returns the default suggestion for an unrecognized route', () => {
    const { result } = renderHook(() =>
      useSuggestions(context({ route: '/settings' })),
    );
    expect(result.current.map(s => s.label)).toEqual([
      'What can you help me with?',
    ]);
  });

  it('returns entity suggestions when a page has an entity ref', () => {
    const { result } = renderHook(() =>
      useSuggestions(
        context({
          route: '/catalog/default/component/x',
          entityRef: 'component:default/x',
        }),
      ),
    );
    expect(result.current.map(s => s.label)).toEqual([
      'Summarize this component',
      'Show Soundcheck status',
      'List recent changes',
    ]);
  });

  it('returns Soundcheck suggestions even on an entity page when the route is a Soundcheck tab', () => {
    const { result } = renderHook(() =>
      useSuggestions(
        context({
          route: '/catalog/default/component/x/soundcheck',
          entityRef: 'component:default/x',
        }),
      ),
    );
    expect(result.current.map(s => s.label)).toEqual([
      'Explain failing checks',
      'Suggest fixes for this entity',
    ]);
  });

  it('returns TechDocs suggestions on a docs page', () => {
    const { result } = renderHook(() =>
      useSuggestions(
        context({
          route: '/docs/default/component/x',
          techDocsPath: '/docs/default/component/x',
        }),
      ),
    );
    expect(result.current.map(s => s.label)).toEqual([
      'Summarize this page',
      'Find related documentation',
    ]);
  });

  it('returns catalog suggestions on the catalog index', () => {
    const { result } = renderHook(() =>
      useSuggestions(context({ route: '/catalog' })),
    );
    expect(result.current.map(s => s.label)).toEqual([
      'Find services owned by my team',
    ]);
  });

  it('appends extra suggestions registered by other plugins', () => {
    const { result } = renderHook(() =>
      useSuggestions(context({ route: '/settings' }), [
        { id: 'extra', label: 'Extra suggestion', prompt: 'Extra suggestion' },
      ]),
    );
    expect(result.current.map(s => s.label)).toEqual([
      'What can you help me with?',
      'Extra suggestion',
    ]);
  });
});
