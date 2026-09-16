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
  StatusAborted,
  StatusOK,
  StatusPending,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import {
  growthBookApiRef,
  GrowthBookExperiment,
  GrowthBookExperimentStatus,
} from '../api/ref';
import { growthbookTranslationRef } from '../translation';

function ExperimentStatus(props: {
  status: GrowthBookExperimentStatus;
}): JSX.Element {
  switch (props.status) {
    case 'running':
      return <StatusOK>Running</StatusOK>;
    case 'stopped':
      return <StatusAborted>Stopped</StatusAborted>;
    case 'draft':
    default:
      return <StatusPending>Draft</StatusPending>;
  }
}

/**
 * A page listing all GrowthBook experiments and their current status.
 *
 * @public
 */
export function ExperimentsPage(): JSX.Element {
  const { t } = useTranslationRef(growthbookTranslationRef);
  const growthBookApi = useApi(growthBookApiRef);

  const {
    value: experiments,
    loading,
    error,
  } = useAsync(async () => growthBookApi.listExperiments(), [growthBookApi]);

  const columns: TableColumn<GrowthBookExperiment>[] = [
    { title: 'Name', field: 'name' },
    {
      title: 'Status',
      render: experiment => <ExperimentStatus status={experiment.status} />,
    },
    {
      title: 'Variations',
      render: experiment => experiment.variations.map(v => v.name).join(', '),
    },
    {
      title: 'Targeting',
      field: 'targetingCondition',
      render: experiment => experiment.targetingCondition ?? '—',
    },
  ];

  if (error) {
    return (
      <Page themeId="tool">
        <Header
          title={t('experimentsPage.title')}
          subtitle={t('experimentsPage.subtitle')}
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
        title={t('experimentsPage.title')}
        subtitle={t('experimentsPage.subtitle')}
      />
      <Content>
        {loading ? (
          <Progress />
        ) : (
          <Table
            title={t('experimentsPage.tableTitle')}
            columns={columns}
            data={experiments ?? []}
            options={{ paging: true, pageSize: 20 }}
          />
        )}
      </Content>
    </Page>
  );
}
