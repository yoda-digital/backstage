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

import useAsync from 'react-use/esm/useAsync';
import { Grid, Paper, Typography } from '@material-ui/core';
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
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { AiUsageRecord } from '@backstage/plugin-ai-gateway-common';
import { aiGatewayApiRef } from '../api/AiGatewayClient';
import { aiGatewayTranslationRef } from '../translation';

const columns: TableColumn<AiUsageRecord>[] = [
  {
    title: 'Timestamp',
    field: 'timestamp',
    render: row => new Date(row.timestamp).toLocaleString(),
  },
  { title: 'Provider', field: 'providerId' },
  { title: 'Model', field: 'modelId' },
  { title: 'User', field: 'userEntityRef' },
  { title: 'Prompt Tokens', field: 'promptTokens', type: 'numeric' },
  { title: 'Completion Tokens', field: 'completionTokens', type: 'numeric' },
];

/**
 * A page that shows a usage dashboard summarizing AI gateway requests and
 * token consumption.
 *
 * @public
 */
export function UsagePage(): JSX.Element {
  const { t } = useTranslationRef(aiGatewayTranslationRef);
  const aiGatewayApi = useApi(aiGatewayApiRef);
  const {
    value: summary,
    loading: summaryLoading,
    error: summaryError,
  } = useAsync(async () => aiGatewayApi.getUsageSummary({}), [aiGatewayApi]);
  const {
    value: records,
    loading: recordsLoading,
    error: recordsError,
  } = useAsync(async () => aiGatewayApi.getUsage({}), [aiGatewayApi]);

  const error = summaryError ?? recordsError;
  if (error) {
    return (
      <Page themeId="tool">
        <Header
          title={t('usagePage.title')}
          subtitle={t('usagePage.subtitle')}
        />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title={t('usagePage.title')} subtitle={t('usagePage.subtitle')} />
      <Content>
        {summaryLoading ? (
          <Progress />
        ) : (
          <Grid container spacing={2} style={{ marginBottom: 16 }}>
            <Grid item xs={12} sm={4}>
              <Paper style={{ padding: 16 }}>
                <Typography variant="subtitle2" color="textSecondary">
                  {t('usagePage.totalRequests')}
                </Typography>
                <Typography variant="h4">
                  {summary?.totalRequests ?? 0}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper style={{ padding: 16 }}>
                <Typography variant="subtitle2" color="textSecondary">
                  {t('usagePage.promptTokens')}
                </Typography>
                <Typography variant="h4">
                  {(summary?.totalPromptTokens ?? 0).toLocaleString()}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper style={{ padding: 16 }}>
                <Typography variant="subtitle2" color="textSecondary">
                  {t('usagePage.completionTokens')}
                </Typography>
                <Typography variant="h4">
                  {(summary?.totalCompletionTokens ?? 0).toLocaleString()}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        )}
        {recordsLoading ? (
          <Progress />
        ) : (
          <Table
            title={t('usagePage.tableTitle')}
            columns={columns}
            data={records ?? []}
            options={{ paging: true, pageSize: 20 }}
          />
        )}
      </Content>
    </Page>
  );
}
