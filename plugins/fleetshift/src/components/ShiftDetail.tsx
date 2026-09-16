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
import { Button, Chip, Grid, Typography } from '@material-ui/core';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';
import ReplayIcon from '@material-ui/icons/Replay';
import useAsync from 'react-use/esm/useAsync';
import { useApi, errorApiRef } from '@backstage/core-plugin-api';
import {
  useRouteRefParams,
  useTranslationRef,
} from '@backstage/frontend-plugin-api';
import {
  CardTab,
  Content,
  ContentHeader,
  Header,
  Link,
  Page,
  Progress,
  ResponseErrorPanel,
  TabbedCard,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  ShiftExecution,
  ShiftStatus,
  TargetStatus,
} from '@backstage/plugin-fleetshift-common';
import { fleetshiftApiRef } from '../api/ref';
import { fleetshiftTranslationRef } from '../translation';
import { shiftDetailRouteRef } from '../routes';
import { ShiftStatusBadge } from './ShiftStatusBadge';
import { LogsTab } from './LogsTab';
import { DiffTab } from './DiffTab';

const EXECUTION_STATUS_TO_SHIFT_STATUS: Record<
  ShiftExecution['status'],
  ShiftStatus
> = {
  pending: 'created',
  running: 'executing',
  succeeded: 'completed',
  failed: 'failed',
};

const TARGET_STATUS_LABEL: Record<TargetStatus, string> = {
  queued: 'Queued',
  cloning: 'Cloning',
  transforming: 'Transforming',
  testing: 'Testing',
  creating_pr: 'Creating PR',
  completed: 'Completed',
  failed: 'Failed',
};

function TargetStatusIndicator(props: { status: TargetStatus }): JSX.Element {
  const { status } = props;
  switch (status) {
    case 'completed':
      return <CheckCircleIcon fontSize="small" htmlColor="#2e7d32" />;
    case 'failed':
      return <ErrorIcon fontSize="small" htmlColor="#c62828" />;
    case 'queued':
      return <RadioButtonUncheckedIcon fontSize="small" color="disabled" />;
    case 'cloning':
    case 'transforming':
    case 'testing':
    case 'creating_pr':
    default:
      return <AutorenewIcon fontSize="small" color="primary" />;
  }
}

/**
 * A page showing the details of a single fleetshift shift, with tabs for an
 * overview, per-target status, real-time execution logs, and a diff preview.
 *
 * @public
 */
export function ShiftDetail(): JSX.Element {
  const { t } = useTranslationRef(fleetshiftTranslationRef);
  const { id } = useRouteRefParams(shiftDetailRouteRef);
  const api = useApi(fleetshiftApiRef);
  const errorApi = useApi(errorApiRef);
  const [executing, setExecuting] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const {
    value: shift,
    loading,
    error,
  } = useAsync(() => api.getShift(id), [api, id, refreshIndex]);

  const handleExecute = useCallback(async () => {
    setExecuting(true);
    try {
      await api.executeShift(id);
      setRefreshIndex(index => index + 1);
    } catch (e) {
      errorApi.post(e as Error);
    } finally {
      setExecuting(false);
    }
  }, [api, id, errorApi]);

  const handleRetry = useCallback(
    async (targetIndex: number) => {
      try {
        await api.retryTarget(id, targetIndex);
        setRefreshIndex(index => index + 1);
      } catch (e) {
        errorApi.post(e as Error);
      }
    },
    [api, id, errorApi],
  );

  const targetColumns: TableColumn<ShiftExecution>[] = [
    { title: 'Target repository', field: 'targetRepoUrl' },
    {
      title: 'Progress',
      render: execution => (
        <Chip
          size="small"
          icon={<TargetStatusIndicator status={execution.targetStatus} />}
          label={TARGET_STATUS_LABEL[execution.targetStatus]}
        />
      ),
    },
    {
      title: 'Status',
      render: execution => (
        <ShiftStatusBadge
          status={EXECUTION_STATUS_TO_SHIFT_STATUS[execution.status]}
        />
      ),
    },
    {
      title: 'Merge request',
      render: execution =>
        execution.mrUrl ? <Link to={execution.mrUrl}>View MR</Link> : '—',
    },
    { title: 'Error', field: 'error' },
    {
      title: 'Actions',
      render: execution => (
        <Button
          size="small"
          startIcon={<ReplayIcon />}
          onClick={() => handleRetry(execution.targetIndex)}
          disabled={execution.status === 'running'}
        >
          Retry
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <Page themeId="tool">
        <Header
          title={t('detailPage.title')}
          subtitle={t('detailPage.subtitle')}
        />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error || !shift) {
    return (
      <Page themeId="tool">
        <Header
          title={t('detailPage.title')}
          subtitle={t('detailPage.subtitle')}
        />
        <Content>
          <ResponseErrorPanel error={error ?? new Error('Shift not found')} />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title={shift.title} subtitle={t('detailPage.subtitle')} />
      <Content>
        <ContentHeader title={shift.title}>
          <Button
            variant="contained"
            color="primary"
            disabled={
              executing ||
              (shift.status !== 'planned' &&
                shift.status !== 'partially_completed')
            }
            onClick={handleExecute}
          >
            Execute
          </Button>
        </ContentHeader>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TabbedCard title={shift.title}>
              <CardTab label="Overview">
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2">Status</Typography>
                    <ShiftStatusBadge status={shift.status} />
                    <Typography variant="subtitle2" style={{ marginTop: 16 }}>
                      Shift type
                    </Typography>
                    <Typography variant="body2">{shift.shiftType}</Typography>
                    <Typography variant="subtitle2" style={{ marginTop: 16 }}>
                      Description
                    </Typography>
                    <Typography variant="body2">{shift.description}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2">Transformation</Typography>
                    <Typography variant="body2">
                      {shift.transformation}
                    </Typography>
                    <Typography variant="subtitle2" style={{ marginTop: 16 }}>
                      Configuration
                    </Typography>
                    <Typography
                      variant="body2"
                      component="pre"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {JSON.stringify(shift.config, undefined, 2)}
                    </Typography>
                  </Grid>
                </Grid>
              </CardTab>
              <CardTab label="Targets">
                {shift.executions.length === 0 ? (
                  <Typography variant="body2">
                    This shift has no targets yet.
                  </Typography>
                ) : (
                  <Table
                    columns={targetColumns}
                    data={shift.executions}
                    options={{ paging: false, search: false, toolbar: false }}
                  />
                )}
              </CardTab>
              <CardTab label="Logs">
                <LogsTab shiftId={shift.id} targets={shift.targets} />
              </CardTab>
              <CardTab label="Diff">
                <DiffTab
                  shiftId={shift.id}
                  targets={shift.targets}
                  executions={shift.executions}
                />
              </CardTab>
            </TabbedCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
