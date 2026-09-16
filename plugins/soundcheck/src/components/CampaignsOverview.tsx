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

import { Table, TableColumn } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { SoundcheckCampaign } from '@backstage/plugin-soundcheck-common';
import Typography from '@material-ui/core/Typography';
import useAsync from 'react-use/lib/useAsync';
import { soundcheckApiRef } from '../api/ref';

const columns: TableColumn<SoundcheckCampaign>[] = [
  { title: 'Name', field: 'name' },
  { title: 'Description', field: 'description' },
  { title: 'Target level', field: 'targetLevel' },
  { title: 'Start date', field: 'startDate' },
  { title: 'End date', field: 'endDate' },
];

/**
 * Table listing all Soundcheck campaigns.
 *
 * @public
 */
export function CampaignsOverview() {
  const api = useApi(soundcheckApiRef);
  const {
    value: campaigns,
    loading,
    error,
  } = useAsync(async () => api.getCampaigns(), [api]);

  if (error) {
    return <Typography color="error">{error.message}</Typography>;
  }

  return (
    <Table<SoundcheckCampaign>
      title="Campaigns"
      isLoading={loading}
      options={{ search: true, paging: true, padding: 'dense' }}
      columns={columns}
      data={campaigns ?? []}
    />
  );
}
