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
import Box from '@material-ui/core/Box';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Chip from '@material-ui/core/Chip';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { soundcheckApiRef } from '../../api/ref';
import { LineChart } from '../Charts/LineChart';
import { ProgressBar } from '../Charts/ProgressBar';

function daysRemainingLabel(daysRemaining: number): string {
  if (daysRemaining < 0) {
    return `Ended ${Math.abs(daysRemaining)} day${
      Math.abs(daysRemaining) === 1 ? '' : 's'
    } ago`;
  }
  if (daysRemaining === 0) {
    return 'Ends today';
  }
  return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;
}

/**
 * Insights page for a single Soundcheck campaign, showing progress toward
 * each track milestone, the pass rate trend, and days remaining.
 *
 * @public
 */
export function CampaignInsights() {
  const { id = '' } = useParams();
  const api = useApi(soundcheckApiRef);
  const theme = useTheme();

  const {
    value: insights,
    loading,
    error,
  } = useAsync(async () => api.getCampaignInsights(id), [api, id]);

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Campaign insights" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Campaign insights" />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  const daysRemaining = insights?.daysRemaining ?? 0;
  let badgeColor = theme.palette.status.ok;
  if (daysRemaining < 0) {
    badgeColor = theme.palette.status.error;
  } else if (daysRemaining <= 7) {
    badgeColor = theme.palette.status.warning;
  }

  return (
    <Page themeId="tool">
      <Header title={`Campaign insights: ${id}`}>
        <Chip
          label={daysRemainingLabel(daysRemaining)}
          style={{
            backgroundColor: badgeColor,
            color: theme.palette.getContrastText(badgeColor),
          }}
        />
      </Header>
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Milestones
                </Typography>
                <Box
                  display="flex"
                  flexDirection="column"
                  gridGap={theme.spacing(2)}
                >
                  {(insights?.milestones ?? []).map(milestone => (
                    <ProgressBar
                      key={milestone.levelName}
                      label={`${milestone.levelName} (${milestone.certifiedCount}/${milestone.totalCount})`}
                      value={milestone.percentage}
                      color={theme.palette.primary.main}
                    />
                  ))}
                  {(insights?.milestones ?? []).length === 0 && (
                    <Typography variant="body2" color="textSecondary">
                      No milestones to show yet.
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Pass rate trend
                </Typography>
                <LineChart
                  data={insights?.passRateTrend ?? []}
                  lines={[
                    {
                      key: 'passRate',
                      color: theme.palette.status.ok,
                      label: 'Pass rate (%)',
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
