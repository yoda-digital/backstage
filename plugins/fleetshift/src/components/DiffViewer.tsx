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

import { useMemo, useState } from 'react';
import { Chip, Typography, makeStyles, Theme } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import InsertDriveFileOutlinedIcon from '@material-ui/icons/InsertDriveFileOutlined';
import { DiffFile, DiffLine } from '@backstage/plugin-fleetshift-common';

const useStyles = makeStyles<Theme>(theme => ({
  root: {
    display: 'grid',
    gridTemplateColumns: '260px 1fr',
    gap: theme.spacing(2),
    minHeight: 320,
  },
  tree: {
    borderRight: `1px solid ${theme.palette.divider}`,
    paddingRight: theme.spacing(1),
    overflowY: 'auto',
    maxHeight: 640,
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    padding: theme.spacing(0.5, 0),
    fontWeight: theme.typography.fontWeightBold as number,
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    cursor: 'pointer',
    padding: theme.spacing(0.5, 0, 0.5, 2),
    borderRadius: theme.shape.borderRadius,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  fileRowSelected: {
    backgroundColor: theme.palette.action.selected,
  },
  filePath: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 13,
  },
  diffPane: {
    overflowX: 'auto',
  },
  hunkHeader: {
    backgroundColor: theme.palette.action.hover,
    padding: theme.spacing(0.5, 1),
    fontFamily: 'Menlo, Consolas, monospace',
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '48px 1fr 48px 1fr',
    fontFamily: 'Menlo, Consolas, monospace',
    fontSize: 12.5,
  },
  lineNumber: {
    textAlign: 'right',
    paddingRight: theme.spacing(1),
    color: theme.palette.text.disabled,
    userSelect: 'none',
  },
  code: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    padding: theme.spacing(0, 1),
  },
  add: {
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(46, 160, 67, 0.25)'
        : 'rgba(46, 160, 67, 0.15)',
  },
  remove: {
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(248, 81, 73, 0.25)'
        : 'rgba(248, 81, 73, 0.15)',
  },
  empty: {
    padding: theme.spacing(4),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));

interface DiffRow {
  left?: DiffLine;
  right?: DiffLine;
}

function pairLines(lines: DiffLine[]): DiffRow[] {
  const rows: DiffRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.type === 'context') {
      rows.push({ left: line, right: line });
      i++;
      continue;
    }
    const removes: DiffLine[] = [];
    while (i < lines.length && lines[i].type === 'remove') {
      removes.push(lines[i]);
      i++;
    }
    const adds: DiffLine[] = [];
    while (i < lines.length && lines[i].type === 'add') {
      adds.push(lines[i]);
      i++;
    }
    const max = Math.max(removes.length, adds.length);
    for (let j = 0; j < max; j++) {
      rows.push({ left: removes[j], right: adds[j] });
    }
  }
  return rows;
}

function groupByDirectory(files: DiffFile[]): Map<string, DiffFile[]> {
  const groups = new Map<string, DiffFile[]>();
  for (const file of files) {
    const segments = file.path.split('/');
    const dir = segments.length > 1 ? segments.slice(0, -1).join('/') : '/';
    const existing = groups.get(dir) ?? [];
    existing.push(file);
    groups.set(dir, existing);
  }
  return groups;
}

const CHANGE_TYPE_LABEL: Record<DiffFile['changeType'], string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
};

/**
 * Renders a side-by-side diff for a set of {@link DiffFile}s: a collapsible
 * file tree on the left, and green/red highlighted hunks with line numbers
 * on the right.
 *
 * @public
 */
export function DiffViewer(props: { files: DiffFile[] }): JSX.Element {
  const { files } = props;
  const classes = useStyles();
  const [selectedPath, setSelectedPath] = useState<string | undefined>(
    files[0]?.path,
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );

  const groups = useMemo(() => groupByDirectory(files), [files]);
  const selectedFile = files.find(file => file.path === selectedPath);

  function toggleGroup(dir: string): void {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(dir)) {
        next.delete(dir);
      } else {
        next.add(dir);
      }
      return next;
    });
  }

  if (files.length === 0) {
    return (
      <Typography variant="body2" className={classes.empty}>
        No changes to display.
      </Typography>
    );
  }

  return (
    <div className={classes.root}>
      <nav className={classes.tree}>
        {[...groups.entries()].map(([dir, dirFiles]) => {
          const collapsed = collapsedGroups.has(dir);
          return (
            <div key={dir}>
              <div
                className={classes.groupHeader}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter') toggleGroup(dir);
                }}
                onClick={() => toggleGroup(dir)}
              >
                {collapsed ? <ChevronRightIcon /> : <ExpandMoreIcon />}
                <Typography variant="caption" className={classes.filePath}>
                  {dir}
                </Typography>
              </div>
              {!collapsed &&
                dirFiles.map(file => (
                  <div
                    key={file.path}
                    className={`${classes.fileRow} ${
                      file.path === selectedPath ? classes.fileRowSelected : ''
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter') setSelectedPath(file.path);
                    }}
                    onClick={() => setSelectedPath(file.path)}
                  >
                    <InsertDriveFileOutlinedIcon fontSize="small" />
                    <Typography variant="body2" className={classes.filePath}>
                      {file.path.split('/').pop()}
                    </Typography>
                    <Chip
                      size="small"
                      label={CHANGE_TYPE_LABEL[file.changeType]}
                    />
                  </div>
                ))}
            </div>
          );
        })}
      </nav>
      <div className={classes.diffPane}>
        {!selectedFile ? (
          <Typography variant="body2" className={classes.empty}>
            Select a file to view its diff.
          </Typography>
        ) : (
          selectedFile.hunks.map((hunk, hunkIndex) => (
            <div key={hunkIndex}>
              <div className={classes.hunkHeader}>{hunk.header}</div>
              {pairLines(hunk.lines).map((row, rowIndex) => (
                <div key={rowIndex} className={classes.row}>
                  <div className={classes.lineNumber}>
                    {row.left?.oldLineNumber ?? ''}
                  </div>
                  <div
                    className={`${classes.code} ${
                      row.left?.type === 'remove' ? classes.remove : ''
                    }`}
                  >
                    {row.left?.content ?? ''}
                  </div>
                  <div className={classes.lineNumber}>
                    {row.right?.newLineNumber ?? ''}
                  </div>
                  <div
                    className={`${classes.code} ${
                      row.right?.type === 'add' ? classes.add : ''
                    }`}
                  >
                    {row.right?.content ?? ''}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
