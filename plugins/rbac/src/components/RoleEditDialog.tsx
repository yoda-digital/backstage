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

import React, { useEffect, useState } from 'react';
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
import { RbacPolicyRule, RbacRole } from '@backstage/plugin-rbac-common';

const emptyRule: RbacPolicyRule = { permission: '', action: 'allow' };

/**
 * Props for {@link RoleEditDialog}.
 *
 * @public
 */
export interface RoleEditDialogProps {
  open: boolean;
  role?: RbacRole;
  onClose: () => void;
  onSave: (role: {
    name: string;
    description: string;
    permissions: RbacPolicyRule[];
  }) => Promise<void>;
}

export function RoleEditDialog(props: RoleEditDialogProps): React.JSX.Element {
  const { open, role, onClose, onSave } = props;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<RbacPolicyRule[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(role?.name ?? '');
      setDescription(role?.description ?? '');
      setPermissions(role?.permissions ?? []);
    }
  }, [open, role]);

  const isEditing = Boolean(role);

  const handlePermissionChange = (
    index: number,
    field: keyof RbacPolicyRule,
    value: string,
  ) => {
    setPermissions(current =>
      current.map((rule, i) =>
        i === index ? { ...rule, [field]: value } : rule,
      ),
    );
  };

  const handleAddPermission = () => {
    setPermissions(current => [...current, { ...emptyRule }]);
  };

  const handleRemovePermission = (index: number) => {
    setPermissions(current => current.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ name, description, permissions });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? 'Edit role' : 'Create role'}</DialogTitle>
      <DialogContent>
        <TextField
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={isEditing}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          fullWidth
          margin="normal"
        />
        <Typography variant="subtitle2" style={{ marginTop: 16 }}>
          Permissions
        </Typography>
        {permissions.map((rule, index) => (
          <div
            key={index}
            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <TextField
              label="Permission"
              value={rule.permission}
              onChange={e =>
                handlePermissionChange(index, 'permission', e.target.value)
              }
              margin="dense"
              style={{ flex: 1 }}
            />
            <TextField
              select
              label="Action"
              value={rule.action}
              onChange={e =>
                handlePermissionChange(index, 'action', e.target.value)
              }
              margin="dense"
              style={{ width: 120 }}
            >
              <MenuItem value="allow">allow</MenuItem>
              <MenuItem value="deny">deny</MenuItem>
            </TextField>
            <IconButton
              size="small"
              aria-label="remove permission"
              onClick={() => handleRemovePermission(index)}
            >
              <DeleteIcon />
            </IconButton>
          </div>
        ))}
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddPermission}
        >
          Add permission
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          color="primary"
          variant="contained"
          onClick={handleSave}
          disabled={saving || !name}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
