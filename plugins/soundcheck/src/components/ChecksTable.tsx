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

import { Table, TableColumn, TableProps } from '@backstage/core-components';
import { SoundcheckCheck } from '@backstage/plugin-soundcheck-common';
import EditIcon from '@material-ui/icons/Edit';
import Typography from '@material-ui/core/Typography';
import useAsync from 'react-use/lib/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import { soundcheckApiRef } from '../api/ref';

const columns: TableColumn<SoundcheckCheck>[] = [
  { title: 'Name', field: 'name' },
  { title: 'Description', field: 'description' },
  { title: 'Fact', field: 'factRef' },
  { title: 'Owner', field: 'ownerEntityRef' },
];

/**
 * Props for {@link ChecksTable}.
 *
 * @public
 */
export interface ChecksTableProps {
  /** Called with a check when its edit action is clicked. */
  onEdit?: (check: SoundcheckCheck) => void;
  /** Bump this value to force the check list to be refetched. */
  refreshToken?: number;
}

/**
 * Table listing all Soundcheck checks registered in the catalog.
 *
 * @public
 */
export function ChecksTable(props: ChecksTableProps) {
  const { onEdit, refreshToken } = props;
  const api = useApi(soundcheckApiRef);
  const {
    value: checks,
    loading,
    error,
  } = useAsync(async () => api.getChecks(), [api, refreshToken]);

  if (error) {
    return <Typography color="error">{error.message}</Typography>;
  }

  const actions: TableProps<SoundcheckCheck>['actions'] = onEdit
    ? [
        (check: SoundcheckCheck) => ({
          icon: () => <EditIcon fontSize="small" />,
          tooltip: 'Edit check',
          onClick: () => onEdit(check),
        }),
      ]
    : undefined;

  return (
    <Table<SoundcheckCheck>
      title="Checks"
      isLoading={loading}
      options={{
        search: true,
        paging: true,
        padding: 'dense',
        actionsColumnIndex: -1,
      }}
      columns={columns}
      data={checks ?? []}
      actions={actions}
    />
  );
}
