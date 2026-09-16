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
import useAsync from 'react-use/esm/useAsync';
import { Switch } from '@material-ui/core';
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
import { AiRule } from '@backstage/plugin-ai-explorer-common';
import { aiExplorerApiRef } from '../api/AiExplorerClient';
import { aiExplorerTranslationRef } from '../translation';

/**
 * A page for browsing and toggling AI guardrail rules.
 *
 * @public
 */
export function RulesPage(): JSX.Element {
  const { t } = useTranslationRef(aiExplorerTranslationRef);
  const aiExplorerApi = useApi(aiExplorerApiRef);
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    value: rules,
    loading,
    error,
  } = useAsync(
    async () => aiExplorerApi.listRules(),
    [aiExplorerApi, refreshKey],
  );

  const handleToggle = useCallback(
    async (rule: AiRule) => {
      await aiExplorerApi.updateRule(rule.id, { enabled: !rule.enabled });
      setRefreshKey(key => key + 1);
    },
    [aiExplorerApi],
  );

  const columns: TableColumn<AiRule>[] = [
    { title: 'Name', field: 'name' },
    { title: 'Type', field: 'type' },
    { title: 'Description', field: 'description' },
    {
      title: 'Enabled',
      render: row => (
        <Switch
          checked={row.enabled}
          size="small"
          onChange={() => handleToggle(row)}
        />
      ),
    },
  ];

  if (error) {
    return (
      <Page themeId="tool">
        <Header
          title={t('rulesPage.title')}
          subtitle={t('rulesPage.subtitle')}
        />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title={t('rulesPage.title')} subtitle={t('rulesPage.subtitle')} />
      <Content>
        {loading ? (
          <Progress />
        ) : (
          <Table
            title={t('rulesPage.tableTitle')}
            columns={columns}
            data={rules ?? []}
            options={{ paging: true, pageSize: 20 }}
          />
        )}
      </Content>
    </Page>
  );
}
