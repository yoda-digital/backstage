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
import { useApi } from '@backstage/core-plugin-api';
import {
  Content,
  Header,
  Page,
  Progress,
  ResponseErrorPanel,
  StatusError,
  StatusOK,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { AiProviderInfo } from '@backstage/plugin-ai-gateway-common';
import { aiGatewayApiRef } from '../api/AiGatewayClient';
import { aiGatewayTranslationRef } from '../translation';

const columns: TableColumn<AiProviderInfo>[] = [
  { title: 'Provider', field: 'providerId' },
  { title: 'Display Name', field: 'displayName' },
  {
    title: 'Status',
    render: row =>
      row.status === 'connected' ? (
        <StatusOK>Connected</StatusOK>
      ) : (
        <StatusError>
          {row.status === 'error' ? 'Error' : 'Disconnected'}
        </StatusError>
      ),
  },
  { title: 'Models', field: 'modelCount', type: 'numeric' },
];

/**
 * A page that lists registered AI providers and their connection status.
 *
 * @public
 */
export function ProvidersPage(): JSX.Element {
  const { t } = useTranslationRef(aiGatewayTranslationRef);
  const aiGatewayApi = useApi(aiGatewayApiRef);
  const {
    value: providers,
    loading,
    error,
  } = useAsync(async () => aiGatewayApi.listProviders(), [aiGatewayApi]);

  if (error) {
    return (
      <Page themeId="tool">
        <Header
          title={t('providersPage.title')}
          subtitle={t('providersPage.subtitle')}
        />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header
        title={t('providersPage.title')}
        subtitle={t('providersPage.subtitle')}
      />
      <Content>
        {loading ? (
          <Progress />
        ) : (
          <Table
            title={t('providersPage.tableTitle')}
            columns={columns}
            data={providers ?? []}
            options={{ paging: false }}
          />
        )}
      </Content>
    </Page>
  );
}
