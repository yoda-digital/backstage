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

import { useCallback, useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select as MuiSelect,
  makeStyles,
} from '@material-ui/core';
import { useApi, errorApiRef } from '@backstage/core-plugin-api';
import {
  InfoCard,
  Link,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import {
  ShiftExecution,
  ShiftTarget,
} from '@backstage/plugin-fleetshift-common';
import { fleetshiftApiRef } from '../api/ref';
import { DiffViewer } from './DiffViewer';

const useStyles = makeStyles(theme => ({
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    flexWrap: 'wrap',
  },
  targetSelect: {
    minWidth: 280,
  },
}));

/**
 * Fetches and displays the diff produced by a shift against a single
 * target, with a "Create PR" (or "View PR") action per target.
 *
 * @public
 */
export function DiffTab(props: {
  shiftId: string;
  targets: ShiftTarget[];
  executions: ShiftExecution[];
}): JSX.Element {
  const { shiftId, targets, executions } = props;
  const classes = useStyles();
  const api = useApi(fleetshiftApiRef);
  const errorApi = useApi(errorApiRef);

  const [targetIndex, setTargetIndex] = useState(0);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [creatingPr, setCreatingPr] = useState(false);

  const {
    value: diff,
    loading,
    error,
  } = useAsync(
    () => api.getTargetDiff(shiftId, targetIndex),
    [api, shiftId, targetIndex, refreshIndex],
  );

  const execution = executions.find(e => e.targetIndex === targetIndex);

  const handleCreatePr = useCallback(async () => {
    setCreatingPr(true);
    try {
      await api.retryTarget(shiftId, targetIndex);
      setRefreshIndex(index => index + 1);
    } catch (e) {
      errorApi.post(e as Error);
    } finally {
      setCreatingPr(false);
    }
  }, [api, shiftId, targetIndex, errorApi]);

  return (
    <InfoCard title="Diff preview">
      <div className={classes.toolbar}>
        <FormControl className={classes.targetSelect}>
          <InputLabel id="diff-target-label">Target repository</InputLabel>
          <MuiSelect
            labelId="diff-target-label"
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
        {execution?.mrUrl ? (
          <Link to={execution.mrUrl}>
            <Button variant="outlined" color="primary">
              View PR
            </Button>
          </Link>
        ) : (
          <Button
            variant="contained"
            color="primary"
            disabled={creatingPr}
            onClick={handleCreatePr}
          >
            Create PR
          </Button>
        )}
      </div>
      {loading && <Progress />}
      {error && <ResponseErrorPanel error={error} />}
      {!loading && !error && diff && <DiffViewer files={diff.files} />}
    </InfoCard>
  );
}
