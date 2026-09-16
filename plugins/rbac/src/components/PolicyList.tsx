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
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import IconButton from '@material-ui/core/IconButton';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import GetAppIcon from '@material-ui/icons/GetApp';
import PublishIcon from '@material-ui/icons/Publish';
import RestoreIcon from '@material-ui/icons/Restore';
import {
  ContentHeader,
  SupportButton,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/esm/useAsync';
import {
  RbacPolicyRecord,
  RbacPolicyStrategy,
} from '@backstage/plugin-rbac-common';
import { rbacApiRef } from '../api/ref';
import { PolicyEditor, PolicyStatusBadge } from './PolicyEditor';
import { YamlImportDialog } from './YamlImportDialog';

interface CreatePolicyDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    strategy: RbacPolicyStrategy;
  }) => Promise<void>;
}

function CreatePolicyDialog(props: CreatePolicyDialogProps): React.JSX.Element {
  const { open, onClose, onCreate } = props;
  const [name, setName] = useState('');
  const [strategy, setStrategy] = useState<RbacPolicyStrategy>('first-match');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await onCreate({ name, strategy });
      setName('');
      setStrategy('first-match');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create draft policy</DialogTitle>
      <DialogContent>
        <TextField
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          fullWidth
          margin="normal"
        />
        <TextField
          select
          label="Resolution strategy"
          value={strategy}
          onChange={e => setStrategy(e.target.value as RbacPolicyStrategy)}
          fullWidth
          margin="normal"
        >
          <MenuItem value="first-match">first-match</MenuItem>
          <MenuItem value="any-allow">any-allow</MenuItem>
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          color="primary"
          variant="contained"
          onClick={handleCreate}
          disabled={saving || !name}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function downloadYaml(name: string, content: string): void {
  const blob = new Blob([content], { type: 'application/x-yaml' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${name}.yaml`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Lists RBAC policies with their lifecycle status, and provides actions to
 * create, edit, publish, republish, export, and delete them.
 */
export function PolicyList(): React.JSX.Element {
  const rbacApi = useApi(rbacApiRef);
  const [refresh, setRefresh] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | undefined>(
    undefined,
  );

  const {
    value: policies,
    loading,
    error,
  } = useAsync(() => rbacApi.listPolicies(), [rbacApi, refresh]);

  const handleCreate = useCallback(
    async (input: { name: string; strategy: RbacPolicyStrategy }) => {
      const policy = await rbacApi.createPolicy(input);
      setRefresh(r => r + 1);
      setEditingPolicyId(policy.id);
    },
    [rbacApi],
  );

  const handlePublish = useCallback(
    async (id: string) => {
      await rbacApi.publishPolicy(id);
      setRefresh(r => r + 1);
    },
    [rbacApi],
  );

  const handleRepublish = useCallback(
    async (id: string) => {
      await rbacApi.republishPolicy(id);
      setRefresh(r => r + 1);
    },
    [rbacApi],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await rbacApi.deletePolicy(id);
      setRefresh(r => r + 1);
    },
    [rbacApi],
  );

  const handleExport = useCallback(
    async (policy: RbacPolicyRecord) => {
      const content = await rbacApi.exportPolicy(policy.id);
      downloadYaml(policy.name, content);
    },
    [rbacApi],
  );

  const columns: TableColumn<RbacPolicyRecord>[] = [
    { title: 'Name', field: 'name' },
    {
      title: 'Status',
      render: row => <PolicyStatusBadge status={row.status} />,
    },
    { title: 'Strategy', field: 'strategy' },
    {
      title: 'Created',
      render: row => new Date(row.createdAt).toLocaleString(),
    },
    {
      title: 'Actions',
      render: row => (
        <>
          <IconButton
            size="small"
            aria-label="edit"
            onClick={() => setEditingPolicyId(row.id)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          {row.status === 'draft' && (
            <IconButton
              size="small"
              aria-label="publish"
              onClick={() => handlePublish(row.id)}
            >
              <PublishIcon fontSize="small" />
            </IconButton>
          )}
          {row.status === 'inactive' && (
            <IconButton
              size="small"
              aria-label="republish"
              onClick={() => handleRepublish(row.id)}
            >
              <RestoreIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton
            size="small"
            aria-label="export"
            onClick={() => handleExport(row)}
          >
            <GetAppIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label="delete"
            disabled={row.status !== 'draft'}
            onClick={() => handleDelete(row.id)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <div>
      <ContentHeader title="Policies">
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          Create draft
        </Button>
        <Button onClick={() => setImportOpen(true)}>Import YAML</Button>
        <SupportButton>
          Manage RBAC policy drafts, publish them, and export them as YAML
        </SupportButton>
      </ContentHeader>
      <Table
        title="Policies"
        columns={columns}
        data={policies ?? []}
        isLoading={loading}
        options={{ paging: true, pageSize: 20 }}
      />
      {error && (
        <Typography color="error">
          Failed to load policies: {error.message}
        </Typography>
      )}
      <CreatePolicyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
      <YamlImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => setRefresh(r => r + 1)}
      />
      <Dialog
        open={Boolean(editingPolicyId)}
        onClose={() => setEditingPolicyId(undefined)}
        maxWidth="md"
        fullWidth
      >
        {editingPolicyId && (
          <PolicyEditor
            policyId={editingPolicyId}
            onClose={() => setEditingPolicyId(undefined)}
            onChanged={() => setRefresh(r => r + 1)}
          />
        )}
      </Dialog>
    </div>
  );
}
