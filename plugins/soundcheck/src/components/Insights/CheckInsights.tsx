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

import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import {
  Content,
  Header,
  Page,
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useTheme } from '@material-ui/core/styles';
import grey from '@material-ui/core/colors/grey';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { SoundcheckCheckResult } from '@backstage/plugin-soundcheck-common';
import { soundcheckApiRef } from '../../api/ref';
import { DonutChart } from '../Charts/DonutChart';
import { LineChart } from '../Charts/LineChart';

const statusLookup: Record<string, string> = {
  pass: 'pass',
  fail: 'fail',
  error: 'error',
  exempt: 'exempt',
  unknown: 'unknown',
};

const entityColumns: TableColumn<SoundcheckCheckResult>[] = [
  { title: 'Entity', field: 'entityRef' },
  { title: 'Status', field: 'status', lookup: statusLookup },
  { title: 'Message', field: 'message' },
  { title: 'Evaluated at', field: 'evaluatedAt' },
];

/**
 * Insights page for a single Soundcheck check, showing the current
 * pass/fail/warning/exempt distribution, a historical trend line, and a
 * filterable table of every evaluated entity.
 *
 * @public
 */
export function CheckInsights() {
  const { id = '' } = useParams();
  const api = useApi(soundcheckApiRef);
  const theme = useTheme();

  const {
    value: insights,
    loading,
    error,
  } = useAsync(async () => api.getCheckInsights(id), [api, id]);

  const donutData = useMemo(() => {
    if (!insights) {
      return [];
    }
    const { distribution } = insights;
    return [
      {
        label: 'Pass',
        value: distribution.pass,
        color: theme.palette.status.ok,
      },
      {
        label: 'Fail',
        value: distribution.fail,
        color: theme.palette.status.error,
      },
      {
        label: 'Warning',
        value: distribution.warning,
        color: theme.palette.status.warning,
      },
      {
        label: 'Exempt',
        value: distribution.exempt,
        color: theme.palette.primary.light,
      },
      { label: 'Unknown', value: distribution.unknown, color: grey[500] },
    ];
  }, [insights, theme]);

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Check insights" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Check insights" />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title={`Check insights: ${id}`} />
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <DonutChart data={donutData} title="Current distribution" />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Historical trend
                </Typography>
                <LineChart
                  data={insights?.trend ?? []}
                  lines={[
                    {
                      key: 'pass',
                      color: theme.palette.status.ok,
                      label: 'Pass',
                    },
                    {
                      key: 'fail',
                      color: theme.palette.status.error,
                      label: 'Fail',
                    },
                    {
                      key: 'warning',
                      color: theme.palette.status.warning,
                      label: 'Warning',
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Table<SoundcheckCheckResult>
              title="Evaluated entities"
              options={{ search: true, paging: true, filtering: true }}
              columns={entityColumns}
              data={insights?.entities ?? []}
            />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
