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

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp } from '@backstage/test-utils';
import { DiffFile } from '@backstage/plugin-fleetshift-common';
import { DiffViewer } from './DiffViewer';

const files: DiffFile[] = [
  {
    path: 'src/index.ts',
    changeType: 'modified',
    hunks: [
      {
        header: '@@ -1,2 +1,2 @@',
        lines: [
          { type: 'remove', content: 'const a = 1;', oldLineNumber: 1 },
          { type: 'add', content: 'const a = 2;', newLineNumber: 1 },
          {
            type: 'context',
            content: 'const b = 3;',
            oldLineNumber: 2,
            newLineNumber: 2,
          },
        ],
      },
    ],
  },
  {
    path: 'README.md',
    changeType: 'added',
    hunks: [
      {
        header: '@@ -0,0 +1,1 @@',
        lines: [{ type: 'add', content: 'hello', newLineNumber: 1 }],
      },
    ],
  },
];

describe('DiffViewer', () => {
  it('shows an empty state when there are no files', async () => {
    await renderInTestApp(<DiffViewer files={[]} />);
    expect(
      await screen.findByText('No changes to display.'),
    ).toBeInTheDocument();
  });

  it('selects the first file by default and renders its paired diff lines', async () => {
    await renderInTestApp(<DiffViewer files={files} />);

    expect(await screen.findByText('index.ts')).toBeInTheDocument();
    expect(screen.getByText('const a = 1;')).toBeInTheDocument();
    expect(screen.getByText('const a = 2;')).toBeInTheDocument();
    // The context line is shared by both sides, so it appears once per side.
    expect(screen.getAllByText('const b = 3;')).toHaveLength(2);
  });

  it('switches the displayed diff when another file is selected', async () => {
    await renderInTestApp(<DiffViewer files={files} />);

    await userEvent.click(await screen.findByText('README.md'));

    expect(await screen.findByText('hello')).toBeInTheDocument();
    expect(screen.queryByText('const a = 1;')).not.toBeInTheDocument();
  });
});
