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

import { resolvePath } from './pathResolvers';

const data = {
  status: 'success',
  count: 3,
  nested: { deep: { value: 42 } },
  tags: ['a', 'b', 'c'],
};

describe('resolvePath', () => {
  it('defaults to the jsonpath resolver', async () => {
    await expect(resolvePath(undefined, data, '$.status')).resolves.toEqual(
      'success',
    );
  });

  it('resolves with jsonpath', async () => {
    await expect(
      resolvePath('jsonpath', data, '$.nested.deep.value'),
    ).resolves.toEqual(42);
    await expect(resolvePath('jsonpath', data, '$.tags[*]')).resolves.toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('resolves with lodash dot notation', async () => {
    await expect(
      resolvePath('lodash', data, 'nested.deep.value'),
    ).resolves.toEqual(42);
    await expect(
      resolvePath('lodash', data, 'missing.path'),
    ).resolves.toBeUndefined();
  });

  it('resolves with jmespath', async () => {
    await expect(
      resolvePath('jmespath', data, 'nested.deep.value'),
    ).resolves.toEqual(42);
    await expect(resolvePath('jmespath', data, 'tags[0]')).resolves.toEqual(
      'a',
    );
  });

  it('resolves with jsonata', async () => {
    await expect(
      resolvePath('jsonata', data, 'nested.deep.value'),
    ).resolves.toEqual(42);
    await expect(resolvePath('jsonata', data, 'count * 2')).resolves.toEqual(6);
  });

  it('throws for an unsupported resolver', async () => {
    await expect(
      resolvePath('bogus' as never, data, '$.status'),
    ).rejects.toThrow(/Unsupported Soundcheck path resolver/);
  });
});
