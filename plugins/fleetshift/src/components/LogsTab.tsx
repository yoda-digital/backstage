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

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select as MuiSelect,
  Typography,
  makeStyles,
} from '@material-ui/core';
import PauseIcon from '@material-ui/icons/Pause';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import GetAppIcon from '@material-ui/icons/GetApp';
import { useApi } from '@backstage/core-plugin-api';
import { InfoCard } from '@backstage/core-components';
import { LogEntry, ShiftTarget } from '@backstage/plugin-fleetshift-common';
import { fleetshiftApiRef } from '../api/ref';

const POLL_INTERVAL_MS = 2000;

const useStyles = makeStyles(theme => ({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    flexWrap: 'wrap',
  },
  targetSelect: {
    minWidth: 280,
  },
  logContainer: {
    backgroundColor: theme.palette.type === 'dark' ? '#1e1e1e' : '#0d1117',
    color: '#d4d4d4',
    fontFamily: 'Menlo, Consolas, monospace',
    fontSize: 13,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    height: 480,
    overflowY: 'auto',
  },
  line: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: 1.6,
  },
  info: {
    color: '#d4d4d4',
  },
  warn: {
    color: '#ffab40',
  },
  error: {
    color: '#ff6e6e',
  },
  timestamp: {
    color: '#6e7681',
    marginRight: theme.spacing(1),
  },
}));

/**
 * Renders a color-coded, auto-scrolling, pausable log viewer for a single
 * target of a shift, polling the backend for new log entries.
 *
 * @public
 */
export function LogsTab(props: {
  shiftId: string;
  targets: ShiftTarget[];
}): JSX.Element {
  const { shiftId, targets } = props;
  const classes = useStyles();
  const api = useApi(fleetshiftApiRef);

  const [targetIndex, setTargetIndex] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLogs([]);
  }, [shiftId, targetIndex]);

  useEffect(() => {
    let cancelled = false;

    async function poll(): Promise<void> {
      if (paused) {
        return;
      }
      try {
        const nextLogs = await api.getTargetLogs(shiftId, targetIndex);
        if (!cancelled) {
          setLogs(nextLogs);
        }
      } catch {
        // Transient polling failures are not surfaced; the next tick retries.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [api, shiftId, targetIndex, paused]);

  useEffect(() => {
    if (!paused && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, paused]);

  function handleDownload(): void {
    const text = logs
      .map(
        log => `[${log.timestamp}] ${log.level.toUpperCase()} ${log.message}`,
      )
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fleetshift-${shiftId}-target-${targetIndex}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <InfoCard title="Execution logs">
      <div className={classes.toolbar}>
        <FormControl className={classes.targetSelect}>
          <InputLabel id="logs-target-label">Target repository</InputLabel>
          <MuiSelect
            labelId="logs-target-label"
            value={targetIndex}
            onChange={e => setTargetIndex(Number(e.target.value))}
          >
            {targets.map((target, index) => (
              <MenuItem key={target.repoUrl + index} value={index}>
                {target.repoUrl}
              </MenuItem>
            ))}
          </MuiSelect>
        </FormControl>
        <Button
          size="small"
          variant="outlined"
          startIcon={paused ? <PlayArrowIcon /> : <PauseIcon />}
          onClick={() => setPaused(prev => !prev)}
        >
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<GetAppIcon />}
          onClick={handleDownload}
          disabled={logs.length === 0}
        >
          Download
        </Button>
      </div>
      <div ref={containerRef} className={classes.logContainer}>
        {logs.length === 0 ? (
          <Typography variant="body2" className={classes.info}>
            No log output yet.
          </Typography>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className={`${classes.line} ${classes[log.level]}`}
            >
              <span className={classes.timestamp}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {log.message}
            </div>
          ))
        )}
      </div>
    </InfoCard>
  );
}
