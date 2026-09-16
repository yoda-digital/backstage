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

import { matchesEntityFilter } from './filters';

describe('matchesEntityFilter', () => {
  const entity = {
    kind: 'Component',
    spec: { type: 'service', lifecycle: 'production' },
    metadata: { tags: ['java', 'backend'] },
  };

  it('returns true when no filter provided', () => {
    expect(matchesEntityFilter(entity)).toBe(true);
    expect(matchesEntityFilter(entity, undefined)).toBe(true);
  });

  it('filters by kind', () => {
    expect(matchesEntityFilter(entity, { kinds: ['component'] })).toBe(true);
    expect(matchesEntityFilter(entity, { kinds: ['api'] })).toBe(false);
  });

  it('filters by type', () => {
    expect(matchesEntityFilter(entity, { types: ['service'] })).toBe(true);
    expect(matchesEntityFilter(entity, { types: ['website'] })).toBe(false);
  });

  it('filters by lifecycle', () => {
    expect(matchesEntityFilter(entity, { lifecycles: ['production'] })).toBe(
      true,
    );
    expect(matchesEntityFilter(entity, { lifecycles: ['experimental'] })).toBe(
      false,
    );
  });

  it('filters by tags (any match)', () => {
    expect(matchesEntityFilter(entity, { tags: ['java'] })).toBe(true);
    expect(matchesEntityFilter(entity, { tags: ['python'] })).toBe(false);
    expect(matchesEntityFilter(entity, { tags: ['python', 'java'] })).toBe(
      true,
    );
  });

  it('combines multiple filters with AND logic', () => {
    expect(
      matchesEntityFilter(entity, { kinds: ['component'], types: ['service'] }),
    ).toBe(true);
    expect(
      matchesEntityFilter(entity, { kinds: ['component'], types: ['website'] }),
    ).toBe(false);
  });
});
