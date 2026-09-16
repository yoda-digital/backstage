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

import React, { useCallback, useState } from 'react';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import DeleteIcon from '@material-ui/icons/Delete';
import { Table, TableColumn } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/esm/useAsync';
import { RbacSubject } from '@backstage/plugin-rbac-common';
import { rbacApiRef } from '../api/ref';

interface BindingRow {
  subject: RbacSubject;
}

/**
 * Props for {@link BindingsTable}.
 *
 * @public
 */
export interface BindingsTableProps {
  role: string;
}

export function BindingsTable(props: BindingsTableProps): React.JSX.Element {
  const { role } = props;
  const rbacApi = useApi(rbacApiRef);
  const [refresh, setRefresh] = useState(0);
  const [kind, setKind] = useState<RbacSubject['kind']>('user');
  const [name, setName] = useState('');

  const {
    value: bindings,
    loading,
    error,
  } = useAsync(async () => {
    const result = await rbacApi.listBindings(role);
    return result.flatMap(binding =>
      binding.subjects.map(subject => ({ subject })),
    );
  }, [rbacApi, role, refresh]);

  const handleAdd = useCallback(async () => {
    if (!name) {
      return;
    }
    await rbacApi.addBinding(role, { kind, name });
    setName('');
    setRefresh(r => r + 1);
  }, [rbacApi, role, kind, name]);

  const handleRemove = useCallback(
    async (subject: RbacSubject) => {
      await rbacApi.removeBinding(role, subject);
      setRefresh(r => r + 1);
    },
    [rbacApi, role],
  );

  const columns: TableColumn<BindingRow>[] = [
    { title: 'Kind', render: row => row.subject.kind },
    { title: 'Name', render: row => row.subject.name },
    { title: 'Namespace', render: row => row.subject.namespace ?? 'default' },
    {
      title: 'Actions',
      render: row => (
        <IconButton
          size="small"
          aria-label="remove binding"
          onClick={() => handleRemove(row.subject)}
        >
          <DeleteIcon />
        </IconButton>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <TextField
          select
          label="Kind"
          value={kind}
          onChange={e => setKind(e.target.value as RbacSubject['kind'])}
          margin="dense"
          style={{ width: 120 }}
        >
          <MenuItem value="user">user</MenuItem>
          <MenuItem value="group">group</MenuItem>
        </TextField>
        <TextField
          label="Subject name"
          value={name}
          onChange={e => setName(e.target.value)}
          margin="dense"
        />
        <Button color="primary" onClick={handleAdd} disabled={!name}>
          Add binding
        </Button>
      </div>
      <Table
        title={`Bindings for ${role}`}
        columns={columns}
        data={bindings ?? []}
        isLoading={loading}
        options={{ paging: false, search: false }}
      />
      {error && (
        <div role="alert">Failed to load bindings: {error.message}</div>
      )}
    </div>
  );
}
