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
  ContentHeader,
  EmptyState,
  Header,
  Page,
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { SurveyDefinition } from '@backstage/plugin-devex-metrics-common';
import { devexMetricsApiRef } from '../api/ref';

const columns: TableColumn<SurveyDefinition>[] = [
  { title: 'Title', field: 'title' },
  { title: 'Description', field: 'description' },
  {
    title: 'Questions',
    render: survey => survey.questions.length,
  },
  {
    title: 'Active',
    render: survey => (survey.active ? 'Yes' : 'No'),
  },
  {
    title: 'Created',
    render: survey => new Date(survey.createdAt).toLocaleDateString(),
  },
];

/**
 * A page listing developer experience surveys and their status.
 *
 * @public
 */
export function SurveyPage(): JSX.Element {
  const api = useApi(devexMetricsApiRef);
  const {
    value: surveys,
    loading,
    error,
  } = useAsync(() => api.listSurveys(), [api]);

  return (
    <Page themeId="tool">
      <Header title="Surveys" subtitle="Developer experience surveys" />
      <Content>
        <ContentHeader title="All Surveys" />
        {loading && <Progress />}
        {error && <ResponseErrorPanel error={error} />}
        {!loading && !error && (!surveys || surveys.length === 0) && (
          <EmptyState
            missing="data"
            title="No surveys yet"
            description="No developer experience surveys have been created."
          />
        )}
        {!loading && !error && surveys && surveys.length > 0 && (
          <Table
            title="Surveys"
            columns={columns}
            data={surveys}
            options={{ paging: true, pageSize: 10 }}
          />
        )}
      </Content>
    </Page>
  );
}
