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
import { useParams } from 'react-router-dom';
import useAsync from 'react-use/esm/useAsync';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Chip from '@material-ui/core/Chip';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { useApi } from '@backstage/core-plugin-api';
import {
  Content,
  Header,
  Page,
  Progress,
  ResponseErrorPanel,
  StatusAborted,
  StatusOK,
  StatusPending,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { GigMatch, GigStatus } from '@backstage/plugin-skill-exchange-common';
import { skillExchangeApiRef } from '../api/ref';

function GigStatusLabel(props: { status: GigStatus }): JSX.Element {
  switch (props.status) {
    case 'matched':
    case 'active':
    case 'completed':
      return <StatusOK>{props.status}</StatusOK>;
    case 'cancelled':
      return <StatusAborted>{props.status}</StatusAborted>;
    case 'open':
    default:
      return <StatusPending>{props.status}</StatusPending>;
  }
}

/**
 * A page showing the details of a single gig: description, matched
 * candidates with scores, and accept/decline actions.
 *
 * @public
 */
export function GigDetail(): JSX.Element {
  const { id = '' } = useParams();
  const skillExchangeApi = useApi(skillExchangeApiRef);
  const [refreshKey, setRefreshKey] = useState(0);

  const { value, loading, error } = useAsync(async () => {
    const [gig, matches] = await Promise.all([
      skillExchangeApi.getGig(id),
      skillExchangeApi.listMatches(id),
    ]);
    return { gig, matches };
  }, [skillExchangeApi, id, refreshKey]);

  const handleAccept = useCallback(
    async (match: GigMatch) => {
      const applications = await skillExchangeApi.listApplications(
        match.offerId === id ? match.requestId : match.offerId,
      );
      const application = applications[0];
      if (application) {
        await skillExchangeApi.updateApplication(application.id, 'accepted');
      }
      await skillExchangeApi.updateGig(id, { status: 'matched' });
      setRefreshKey(key => key + 1);
    },
    [skillExchangeApi, id],
  );

  const handleDecline = useCallback(
    async (match: GigMatch) => {
      const applications = await skillExchangeApi.listApplications(
        match.offerId === id ? match.requestId : match.offerId,
      );
      const application = applications[0];
      if (application) {
        await skillExchangeApi.updateApplication(application.id, 'rejected');
      }
      setRefreshKey(key => key + 1);
    },
    [skillExchangeApi, id],
  );

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Gig" />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  if (loading || !value) {
    return (
      <Page themeId="tool">
        <Header title="Gig" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  const { gig, matches } = value;

  const columns: TableColumn<GigMatch>[] = [
    {
      title: 'Candidate',
      render: match => (match.offerId === id ? match.requestId : match.offerId),
    },
    {
      title: 'Score',
      render: match => `${Math.round(match.score * 100)}%`,
    },
    {
      title: 'Matched skills',
      render: match => match.matchedSkills.join(', '),
    },
    {
      title: 'Actions',
      render: match => (
        <>
          <Button
            size="small"
            color="primary"
            onClick={() => handleAccept(match)}
          >
            Accept
          </Button>
          <Button size="small" onClick={() => handleDecline(match)}>
            Decline
          </Button>
        </>
      ),
    },
  ];

  return (
    <Page themeId="tool">
      <Header title={gig.title} subtitle={`${gig.type} · ${gig.direction}`} />
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6">Description</Typography>
                <Typography variant="body1" paragraph>
                  {gig.description}
                </Typography>
                <div>
                  {gig.skills.map(skill => (
                    <Chip key={skill} label={skill} size="small" />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card style={{ marginTop: 16 }}>
              <CardContent>
                <Typography variant="h6">Matches</Typography>
                <Table
                  columns={columns}
                  data={matches}
                  options={{ paging: false, search: false, toolbar: false }}
                  emptyContent={
                    <Typography style={{ padding: 16 }}>
                      No matched candidates yet.
                    </Typography>
                  }
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6">Status</Typography>
                <GigStatusLabel status={gig.status} />
                {gig.startDate && (
                  <Typography variant="body2" style={{ marginTop: 8 }}>
                    Starts: {gig.startDate}
                  </Typography>
                )}
                {gig.endDate && (
                  <Typography variant="body2">Ends: {gig.endDate}</Typography>
                )}
                <Typography variant="body2" style={{ marginTop: 8 }}>
                  Created by: {gig.createdBy}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
