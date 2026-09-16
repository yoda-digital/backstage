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

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DiffFile, DiffHunk } from '@backstage/plugin-fleetshift-common';

const execFileAsync = promisify(execFile);

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@.*$/;
const DIFF_GIT_HEADER = /^diff --git a\/(.+) b\/(.+)$/;

/**
 * Runs `git diff` against the working tree in `workDir` and parses the
 * result into structured {@link DiffFile}s for display in the frontend
 * diff viewer. Returns an empty array if `workDir` is not a git repository
 * or the diff cannot be produced.
 *
 * @internal
 */
export async function computeGitDiff(workDir: string): Promise<DiffFile[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['diff', '--no-color', 'HEAD'],
      { cwd: workDir, maxBuffer: 10 * 1024 * 1024 },
    );
    return parseUnifiedDiff(stdout);
  } catch {
    return [];
  }
}

/**
 * Parses `git diff`-style unified diff output into a list of
 * {@link DiffFile}s, each containing {@link DiffHunk}s of
 * addition/removal/context lines.
 *
 * @internal
 */
export function parseUnifiedDiff(diffText: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current:
    | { path: string; changeType: DiffFile['changeType']; hunks: DiffHunk[] }
    | undefined;
  let currentHunk: DiffHunk | undefined;
  let oldLine = 0;
  let newLine = 0;

  for (const line of diffText.split('\n')) {
    const gitHeaderMatch = line.match(DIFF_GIT_HEADER);
    if (gitHeaderMatch) {
      if (current) {
        files.push(current as DiffFile);
      }
      current = { path: gitHeaderMatch[2], changeType: 'modified', hunks: [] };
      currentHunk = undefined;
      continue;
    }
    if (!current) {
      continue;
    }
    if (line.startsWith('new file mode')) {
      current.changeType = 'added';
      continue;
    }
    if (line.startsWith('deleted file mode')) {
      current.changeType = 'deleted';
      continue;
    }
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      continue;
    }
    const hunkMatch = line.match(HUNK_HEADER);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      currentHunk = { header: line, lines: [] };
      current.hunks.push(currentHunk);
      continue;
    }
    if (!currentHunk) {
      continue;
    }
    if (line.startsWith('+')) {
      currentHunk.lines.push({
        type: 'add',
        content: line.slice(1),
        newLineNumber: newLine++,
      });
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({
        type: 'remove',
        content: line.slice(1),
        oldLineNumber: oldLine++,
      });
    } else if (line.startsWith(' ')) {
      currentHunk.lines.push({
        type: 'context',
        content: line.slice(1),
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      });
    }
  }
  if (current) {
    files.push(current as DiffFile);
  }
  return files;
}
