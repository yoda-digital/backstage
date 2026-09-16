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

import { useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import useDebounce from 'react-use/esm/useDebounce';
import { Chip, TextField } from '@material-ui/core';
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
import { AiSkill } from '@backstage/plugin-ai-explorer-common';
import { aiExplorerApiRef } from '../api/AiExplorerClient';
import { aiExplorerTranslationRef } from '../translation';

const columns: TableColumn<AiSkill>[] = [
  { title: 'Name', field: 'name' },
  { title: 'Description', field: 'description' },
  {
    title: 'Tags',
    render: row => (
      <>
        {row.tags.map(tag => (
          <Chip key={tag} label={tag} size="small" style={{ marginRight: 4 }} />
        ))}
      </>
    ),
  },
  { title: 'Variables', render: row => row.variables.length },
];

/**
 * A page for browsing reusable AI prompt skills/templates.
 *
 * @public
 */
export function SkillsPage(): JSX.Element {
  const { t } = useTranslationRef(aiExplorerTranslationRef);
  const aiExplorerApi = useApi(aiExplorerApiRef);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useDebounce(() => setSearch(searchInput), 300, [searchInput]);

  const {
    value: skills,
    loading,
    error,
  } = useAsync(
    async () => aiExplorerApi.listSkills({ search: search || undefined }),
    [aiExplorerApi, search],
  );

  if (error) {
    return (
      <Page themeId="tool">
        <Header
          title={t('skillsPage.title')}
          subtitle={t('skillsPage.subtitle')}
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
        title={t('skillsPage.title')}
        subtitle={t('skillsPage.subtitle')}
      />
      <Content>
        <TextField
          label={t('skillsPage.searchLabel')}
          value={searchInput}
          onChange={event => setSearchInput(event.target.value)}
          style={{ marginBottom: 16 }}
        />
        {loading ? (
          <Progress />
        ) : (
          <Table
            title={t('skillsPage.tableTitle')}
            columns={columns}
            data={skills ?? []}
            options={{ paging: true, pageSize: 20 }}
          />
        )}
      </Content>
    </Page>
  );
}
