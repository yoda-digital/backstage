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

import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { renderHook } from '@testing-library/react';
import { usePageContext } from './usePageContext';

function createWrapper(initialPath: string) {
  return function Wrapper(props: { children?: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialPath]}>
        {props.children}
      </MemoryRouter>
    );
  };
}

describe('usePageContext', () => {
  it('returns just the route and title for a plain page', () => {
    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper('/catalog'),
    });
    expect(result.current.route).toBe('/catalog');
    expect(result.current.entityRef).toBeUndefined();
    expect(result.current.techDocsPath).toBeUndefined();
  });

  it('derives the entity ref from an entity page route', () => {
    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(
        '/catalog/default/component/my-service/soundcheck',
      ),
    });
    expect(result.current.entityRef).toBe('component:default/my-service');
    expect(result.current.entityKind).toBe('component');
  });

  it('derives the entity ref and techDocsPath from a docs page route', () => {
    const path = '/docs/default/component/my-service/some-page';
    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(path),
    });
    expect(result.current.techDocsPath).toBe(path);
    expect(result.current.entityRef).toBe('component:default/my-service');
  });
});
