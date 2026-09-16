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

import { Grid } from '@material-ui/core';
import useAsync from 'react-use/esm/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import {
  Content,
  ContentHeader,
  EmptyState,
  Header,
  InfoCard,
  Page,
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { FeatureUsage, SearchQueryCount } from '../types';
import { insightsApiRef } from '../api/ref';
import { insightsTranslationRef } from '../translation';

const featureColumns: TableColumn<FeatureUsage>[] = [
  { title: 'Feature', field: 'target' },
  { title: 'Uses', field: 'count', type: 'numeric' },
];

const queryColumns: TableColumn<SearchQueryCount>[] = [
  { title: 'Query', field: 'query' },
  { title: 'Count', field: 'count', type: 'numeric' },
];

/**
 * A dashboard summarizing portal adoption: top features, active users, and
 * search analytics.
 *
 * @public
 */
export function InsightsDashboard(): JSX.Element {
  const { t } = useTranslationRef(insightsTranslationRef);
  const api = useApi(insightsApiRef);

  const {
    value: topFeatures,
    loading: featuresLoading,
    error: featuresError,
  } = useAsync(() => api.getTopFeatures(), [api]);

  const {
    value: searchAnalytics,
    loading: searchLoading,
    error: searchError,
  } = useAsync(() => api.getSearchAnalytics(), [api]);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const {
    value: activeUsers,
    loading: activeUsersLoading,
    error: activeUsersError,
  } = useAsync(
    () =>
      api.getAggregations(
        'active_users',
        'day',
        thirtyDaysAgo.toISOString(),
        now.toISOString(),
      ),
    [api],
  );

  return (
    <Page themeId="tool">
      <Header title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />
      <Content>
        <ContentHeader title={t('dashboard.heading')} />
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <InfoCard title={t('dashboard.topFeaturesTitle')}>
              {featuresLoading && <Progress />}
              {featuresError && <ResponseErrorPanel error={featuresError} />}
              {!featuresLoading &&
                !featuresError &&
                (!topFeatures || topFeatures.length === 0) && (
                  <EmptyState
                    missing="data"
                    title={t('dashboard.noFeatureUsageTitle')}
                    description={t('dashboard.noFeatureUsageDescription')}
                  />
                )}
              {!featuresLoading && topFeatures && topFeatures.length > 0 && (
                <Table
                  columns={featureColumns}
                  data={topFeatures}
                  options={{ paging: false, search: false, toolbar: false }}
                />
              )}
            </InfoCard>
          </Grid>
          <Grid item xs={12} md={6}>
            <InfoCard title={t('dashboard.activeUsersTitle')}>
              {activeUsersLoading && <Progress />}
              {activeUsersError && (
                <ResponseErrorPanel error={activeUsersError} />
              )}
              {!activeUsersLoading &&
                !activeUsersError &&
                (!activeUsers || activeUsers.length === 0) && (
                  <EmptyState
                    missing="data"
                    title={t('dashboard.noActivityTitle')}
                    description={t('dashboard.noActivityDescription')}
                  />
                )}
              {!activeUsersLoading && activeUsers && activeUsers.length > 0 && (
                <Table
                  columns={[
                    { title: 'Day', field: 'periodStart' },
                    { title: 'Active Users', field: 'count', type: 'numeric' },
                  ]}
                  data={activeUsers}
                  options={{ paging: false, search: false, toolbar: false }}
                />
              )}
            </InfoCard>
          </Grid>
          <Grid item xs={12} md={6}>
            <InfoCard title={t('dashboard.popularSearchesTitle')}>
              {searchLoading && <Progress />}
              {searchError && <ResponseErrorPanel error={searchError} />}
              {!searchLoading &&
                !searchError &&
                searchAnalytics &&
                searchAnalytics.popularQueries.length > 0 && (
                  <Table
                    columns={queryColumns}
                    data={searchAnalytics.popularQueries}
                    options={{ paging: false, search: false, toolbar: false }}
                  />
                )}
            </InfoCard>
          </Grid>
          <Grid item xs={12} md={6}>
            <InfoCard title={t('dashboard.zeroResultSearchesTitle')}>
              {searchLoading && <Progress />}
              {searchError && <ResponseErrorPanel error={searchError} />}
              {!searchLoading &&
                !searchError &&
                searchAnalytics &&
                searchAnalytics.zeroResultQueries.length > 0 && (
                  <Table
                    columns={queryColumns}
                    data={searchAnalytics.zeroResultQueries}
                    options={{ paging: false, search: false, toolbar: false }}
                  />
                )}
            </InfoCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
