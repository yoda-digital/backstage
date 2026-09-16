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
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { AiModel } from '@backstage/plugin-ai-gateway-common';
import { aiGatewayApiRef } from '../api/AiGatewayClient';
import { aiGatewayTranslationRef } from '../translation';

const columns: TableColumn<AiModel>[] = [
  { title: 'Model', field: 'name' },
  { title: 'Provider', field: 'providerId' },
  {
    title: 'Chat',
    render: row => (row.capabilities.chat ? 'Yes' : 'No'),
  },
  {
    title: 'Streaming',
    render: row => (row.capabilities.streaming ? 'Yes' : 'No'),
  },
  {
    title: 'Vision',
    render: row => (row.capabilities.vision ? 'Yes' : 'No'),
  },
  {
    title: 'Tool Use',
    render: row => (row.capabilities.toolUse ? 'Yes' : 'No'),
  },
  {
    title: 'Max Context',
    field: 'capabilities.maxContextTokens',
    render: row => row.capabilities.maxContextTokens.toLocaleString(),
    type: 'numeric',
  },
];

/**
 * A page that lists all models exposed by registered AI providers.
 *
 * @public
 */
export function ModelsPage(): JSX.Element {
  const { t } = useTranslationRef(aiGatewayTranslationRef);
  const aiGatewayApi = useApi(aiGatewayApiRef);
  const {
    value: models,
    loading,
    error,
  } = useAsync(async () => aiGatewayApi.listModels(), [aiGatewayApi]);

  if (error) {
    return (
      <Page themeId="tool">
        <Header
          title={t('modelsPage.title')}
          subtitle={t('modelsPage.subtitle')}
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
        title={t('modelsPage.title')}
        subtitle={t('modelsPage.subtitle')}
      />
      <Content>
        {loading ? (
          <Progress />
        ) : (
          <Table
            title={t('modelsPage.tableTitle')}
            columns={columns}
            data={models ?? []}
            options={{ paging: true, pageSize: 20 }}
          />
        )}
      </Content>
    </Page>
  );
}
