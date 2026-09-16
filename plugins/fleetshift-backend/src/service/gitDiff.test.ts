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

import { parseUnifiedDiff } from './gitDiff';

describe('parseUnifiedDiff', () => {
  it('parses a modified file with additions, removals and context lines', () => {
    const diff = [
      'diff --git a/src/index.ts b/src/index.ts',
      'index 1111111..2222222 100644',
      '--- a/src/index.ts',
      '+++ b/src/index.ts',
      '@@ -1,3 +1,3 @@',
      ' const a = 1;',
      '-const b = 2;',
      '+const b = 3;',
      ' const c = 3;',
      '',
    ].join('\n');

    const files = parseUnifiedDiff(diff);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('src/index.ts');
    expect(files[0].changeType).toBe('modified');
    expect(files[0].hunks).toHaveLength(1);
    expect(files[0].hunks[0].lines).toEqual([
      {
        type: 'context',
        content: 'const a = 1;',
        oldLineNumber: 1,
        newLineNumber: 1,
      },
      { type: 'remove', content: 'const b = 2;', oldLineNumber: 2 },
      { type: 'add', content: 'const b = 3;', newLineNumber: 2 },
      {
        type: 'context',
        content: 'const c = 3;',
        oldLineNumber: 3,
        newLineNumber: 3,
      },
    ]);
  });

  it('marks newly added and deleted files', () => {
    const diff = [
      'diff --git a/README.md b/README.md',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/README.md',
      '@@ -0,0 +1,1 @@',
      '+hello',
      'diff --git a/old.txt b/old.txt',
      'deleted file mode 100644',
      '--- a/old.txt',
      '+++ /dev/null',
      '@@ -1,1 +0,0 @@',
      '-bye',
    ].join('\n');

    const files = parseUnifiedDiff(diff);

    expect(files).toHaveLength(2);
    expect(files[0]).toMatchObject({ path: 'README.md', changeType: 'added' });
    expect(files[1]).toMatchObject({ path: 'old.txt', changeType: 'deleted' });
  });

  it('returns an empty array for empty input', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
  });
});
