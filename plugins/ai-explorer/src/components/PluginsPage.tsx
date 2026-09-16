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
import { Chip } from '@material-ui/core';
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
import { AiPlugin } from '@backstage/plugin-ai-explorer-common';
import { aiExplorerApiRef } from '../api/AiExplorerClient';
import { aiExplorerTranslationRef } from '../translation';

const columns: TableColumn<AiPlugin>[] = [
  { title: 'Name', field: 'name' },
  { title: 'Description', field: 'description' },
  { title: 'Transport', field: 'transport' },
  { title: 'Server URL', field: 'serverUrl' },
  {
    title: 'Tools',
    render: row => (
      <>
        {row.tools.map(tool => (
          <Chip
            key={tool.name}
            label={tool.name}
            size="small"
            style={{ marginRight: 4 }}
          />
        ))}
      </>
    ),
  },
  {
    title: 'Status',
    render: row =>
      row.enabled ? (
        <StatusOK>Enabled</StatusOK>
      ) : (
        <StatusError>Disabled</StatusError>
      ),
  },
];

/**
 * A page for browsing registered MCP plugins/servers available to the AI
 * platform.
 *
 * @public
 */
export function PluginsPage(): JSX.Element {
  const { t } = useTranslationRef(aiExplorerTranslationRef);
  const aiExplorerApi = useApi(aiExplorerApiRef);
  const {
    value: plugins,
    loading,
    error,
  } = useAsync(async () => aiExplorerApi.listPlugins(), [aiExplorerApi]);

  if (error) {
    return (
      <Page themeId="tool">
        <Header
          title={t('pluginsPage.title')}
          subtitle={t('pluginsPage.subtitle')}
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
        title={t('pluginsPage.title')}
        subtitle={t('pluginsPage.subtitle')}
      />
      <Content>
        {loading ? (
          <Progress />
        ) : (
          <Table
            title={t('pluginsPage.tableTitle')}
            columns={columns}
            data={plugins ?? []}
            options={{ paging: true, pageSize: 20 }}
          />
        )}
      </Content>
    </Page>
  );
}
