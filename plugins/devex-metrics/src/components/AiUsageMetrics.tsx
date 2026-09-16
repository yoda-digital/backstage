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

import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';
import useAsync from 'react-use/esm/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import {
  EmptyState,
  InfoCard,
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { MetricSegment } from '@backstage/plugin-devex-metrics-common';
import { devexMetricsApiRef } from '../api/ref';
import { DonutChart } from './charts/DonutChart';
import { TimeseriesChart } from './charts/TimeseriesChart';

const PALETTE = [
  '#1976d2',
  '#9c27b0',
  '#2e7d32',
  '#f57c00',
  '#c62828',
  '#00838f',
];

interface UserUsageRow {
  readonly user: string;
  readonly requests: number;
  readonly tokens: number;
}

const USER_COLUMNS: TableColumn<UserUsageRow>[] = [
  { title: 'Developer', field: 'user' },
  { title: 'Requests', field: 'requests', type: 'numeric' },
  { title: 'Tokens', field: 'tokens', type: 'numeric' },
];

/**
 * Props for {@link AiUsageMetrics}.
 *
 * @public
 */
export interface AiUsageMetricsProps {
  readonly from: string;
  readonly to: string;
  readonly segment?: MetricSegment;
}

/**
 * Displays AI Gateway usage for the given time range: total requests and
 * tokens, a model usage distribution donut, a request trend over time, and
 * a per-developer breakdown.
 *
 * @public
 */
export function AiUsageMetrics(props: AiUsageMetricsProps): JSX.Element {
  const { from, to, segment } = props;
  const api = useApi(devexMetricsApiRef);
  const theme = useTheme();

  const {
    value: usage,
    loading,
    error,
  } = useAsync(
    () => api.getAiUsage(from, to, segment),
    [api, from, to, segment?.team, segment?.entityRef],
  );

  if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  if (loading) {
    return <Progress />;
  }

  if (!usage || usage.totalRequests === 0) {
    return (
      <EmptyState
        missing="data"
        title="No AI usage data"
        description="No AI Gateway usage was recorded for this range and segment."
      />
    );
  }

  const providerSegments = Object.entries(usage.byProvider).map(
    ([provider, stats], index) => ({
      label: provider,
      value: stats.requests,
      color: PALETTE[index % PALETTE.length],
    }),
  );

  const userRows: UserUsageRow[] = Object.entries(usage.byUser).map(
    ([user, stats]) => ({
      user,
      requests: stats.requests,
      tokens: stats.tokens,
    }),
  );

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={3}>
        <InfoCard title="Total AI requests">
          <Typography variant="h4">{usage.totalRequests}</Typography>
        </InfoCard>
      </Grid>
      <Grid item xs={12} sm={3}>
        <InfoCard title="Total tokens">
          <Typography variant="h4">{usage.totalTokens}</Typography>
        </InfoCard>
      </Grid>
      <Grid item xs={12} sm={6}>
        <InfoCard title="Model distribution">
          <DonutChart segments={providerSegments} />
        </InfoCard>
      </Grid>
      <Grid item xs={12}>
        <InfoCard title="AI requests over time">
          <TimeseriesChart
            yLabel="Requests"
            series={[
              {
                label: 'AI requests',
                color: theme.palette.primary.main,
                data: usage.dataPoints.map(point => ({
                  date: point.date,
                  value: point.value,
                })),
              },
            ]}
          />
        </InfoCard>
      </Grid>
      <Grid item xs={12}>
        <InfoCard title="Usage by developer">
          <Table
            columns={USER_COLUMNS}
            data={userRows}
            options={{ search: true, paging: userRows.length > 10 }}
          />
        </InfoCard>
      </Grid>
    </Grid>
  );
}
