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

import { useNavigate } from 'react-router-dom';
import useAsync from 'react-use/esm/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import {
  Content,
  ContentHeader,
  EmptyState,
  Header,
  Link,
  Page,
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { Button } from '@material-ui/core';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { Shift } from '@backstage/plugin-fleetshift-common';
import { fleetshiftApiRef } from '../api/ref';
import { fleetshiftTranslationRef } from '../translation';
import { ShiftStatusBadge } from './ShiftStatusBadge';

const columns: TableColumn<Shift>[] = [
  {
    title: 'Title',
    render: shift => <Link to={shift.id}>{shift.title}</Link>,
  },
  {
    title: 'Status',
    render: shift => <ShiftStatusBadge status={shift.status} />,
  },
  {
    title: 'Targets',
    render: shift => shift.targets.length,
  },
  {
    title: 'Created by',
    field: 'createdBy',
  },
  {
    title: 'Created',
    render: shift => new Date(shift.createdAt).toLocaleString(),
  },
];

/**
 * A page listing all fleetshift shifts.
 *
 * @public
 */
export function ShiftDashboard(): JSX.Element {
  const { t } = useTranslationRef(fleetshiftTranslationRef);
  const api = useApi(fleetshiftApiRef);
  const navigate = useNavigate();
  const {
    value: shifts,
    loading,
    error,
  } = useAsync(() => api.listShifts(), [api]);

  return (
    <Page themeId="tool">
      <Header title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />
      <Content>
        <ContentHeader title={t('dashboard.shiftsHeading')}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('new')}
          >
            {t('dashboard.newShiftButton')}
          </Button>
        </ContentHeader>
        {loading && <Progress />}
        {error && <ResponseErrorPanel error={error} />}
        {!loading && !error && (!shifts || shifts.length === 0) && (
          <EmptyState
            missing="data"
            title={t('dashboard.noShiftsTitle')}
            description={t('dashboard.noShiftsDescription')}
          />
        )}
        {!loading && !error && shifts && shifts.length > 0 && (
          <Table
            title={t('dashboard.allShiftsTableTitle')}
            columns={columns}
            data={shifts}
            options={{ paging: true, pageSize: 20 }}
          />
        )}
      </Content>
    </Page>
  );
}
