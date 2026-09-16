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
} from '@backstage/core-components';
import { useTheme } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { soundcheckApiRef } from '../../api/ref';
import { DonutChart } from '../Charts/DonutChart';
import { LineChart } from '../Charts/LineChart';

/**
 * Insights page for a single Soundcheck track, showing the current
 * certification distribution per level and its historical adoption trend.
 *
 * @public
 */
export function TrackInsights() {
  const { id = '' } = useParams();
  const api = useApi(soundcheckApiRef);
  const theme = useTheme();

  const {
    value: insights,
    loading,
    error,
  } = useAsync(async () => api.getTrackInsights(id), [api, id]);

  const palette = useMemo(
    () => [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.status.ok,
      theme.palette.status.warning,
      theme.palette.status.error,
    ],
    [theme],
  );

  const levels = useMemo(
    () =>
      (insights?.levelDistribution ?? [])
        .slice()
        .sort((a, b) => a.levelRank - b.levelRank),
    [insights],
  );

  const donutData = useMemo(
    () =>
      levels.map((level, index) => ({
        label: level.levelName,
        value: level.count,
        color: palette[index % palette.length],
      })),
    [levels, palette],
  );

  const lines = useMemo(
    () =>
      levels.map((level, index) => ({
        key: level.levelName,
        label: level.levelName,
        color: palette[index % palette.length],
      })),
    [levels, palette],
  );

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Track insights" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Track insights" />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title={`Track insights: ${id}`} />
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <DonutChart data={donutData} title="Certifications by level" />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Certification trend
                </Typography>
                <LineChart data={insights?.trend ?? []} lines={lines} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
