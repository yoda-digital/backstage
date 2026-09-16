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

import React, { useCallback, useEffect, useState } from 'react';
import Accordion from '@material-ui/core/Accordion';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import CircularProgress from '@material-ui/core/CircularProgress';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/esm/useAsync';
import {
  RbacPolicyRule,
  RbacPolicyStatus,
  RbacPolicyStrategy,
  RbacRole,
} from '@backstage/plugin-rbac-common';
import { rbacApiRef } from '../api/ref';
import { ConditionalRuleBuilder } from './ConditionalRuleBuilder';
import { RoleEditDialog } from './RoleEditDialog';
import { BindingsTable } from './BindingsTable';

const emptyRule: RbacPolicyRule = { permission: '', action: 'allow' };

const STATUS_COLORS: Record<
  RbacPolicyStatus,
  { background: string; color: string }
> = {
  draft: { background: '#e3f2fd', color: '#0d47a1' },
  published: { background: '#e8f5e9', color: '#1b5e20' },
  inactive: { background: '#eeeeee', color: '#424242' },
};

/**
 * Props for {@link PolicyStatusBadge}.
 *
 * @public
 */
export interface PolicyStatusBadgeProps {
  status: RbacPolicyStatus;
}

/**
 * Renders an {@link RbacPolicyStatus} as a colored badge: draft is blue,
 * published is green, and inactive is gray.
 */
export function PolicyStatusBadge(
  props: PolicyStatusBadgeProps,
): React.JSX.Element {
  const { status } = props;
  const { background, color } = STATUS_COLORS[status];
  return (
    <Chip
      size="small"
      label={status}
      style={{ backgroundColor: background, color, fontWeight: 600 }}
    />
  );
}

interface PermissionRuleEditorProps {
  rules: RbacPolicyRule[];
  onChange: (rules: RbacPolicyRule[]) => void;
  disabled?: boolean;
}

/**
 * Edits an ordered list of {@link RbacPolicyRule}s, each with its own
 * conditional rule builder. Used both for a policy's own rules and for the
 * permissions of a role scoped to a policy.
 */
function PermissionRuleEditor(
  props: PermissionRuleEditorProps,
): React.JSX.Element {
  const { rules, onChange, disabled } = props;

  const handleFieldChange = (
    index: number,
    field: 'permission' | 'action',
    value: string,
  ) => {
    onChange(
      rules.map((rule, i) =>
        i === index ? { ...rule, [field]: value } : rule,
      ),
    );
  };

  const handleConditionsChange = (
    index: number,
    conditions: RbacPolicyRule['conditions'],
  ) => {
    onChange(
      rules.map((rule, i) =>
        i === index
          ? {
              ...rule,
              conditions: conditions?.length ? conditions : undefined,
            }
          : rule,
      ),
    );
  };

  const handleAdd = () => {
    onChange([...rules, { ...emptyRule }]);
  };

  const handleRemove = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <div>
      {rules.map((rule, index) => (
        <div
          key={index}
          style={{
            border: '1px solid rgba(0, 0, 0, 0.12)',
            borderRadius: 4,
            padding: 8,
            marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <TextField
              label="Permission"
              value={rule.permission}
              onChange={e =>
                handleFieldChange(index, 'permission', e.target.value)
              }
              margin="dense"
              style={{ flex: 1 }}
              disabled={disabled}
            />
            <TextField
              select
              label="Action"
              value={rule.action}
              onChange={e => handleFieldChange(index, 'action', e.target.value)}
              margin="dense"
              style={{ width: 120 }}
              disabled={disabled}
            >
              <MenuItem value="allow">allow</MenuItem>
              <MenuItem value="deny">deny</MenuItem>
            </TextField>
            <IconButton
              size="small"
              aria-label="remove permission"
              onClick={() => handleRemove(index)}
              disabled={disabled}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </div>
          <ConditionalRuleBuilder
            conditions={rule.conditions ?? []}
            onChange={next => handleConditionsChange(index, next)}
            disabled={disabled}
          />
        </div>
      ))}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={handleAdd}
        disabled={disabled}
      >
        Add permission decision
      </Button>
    </div>
  );
}

interface RolePanelProps {
  role: RbacRole;
  onSave: (permissions: RbacPolicyRule[]) => Promise<void>;
  onDelete: () => Promise<void>;
}

function RolePanel(props: RolePanelProps): React.JSX.Element {
  const { role, onSave, onDelete } = props;
  const [permissions, setPermissions] = useState<RbacPolicyRule[]>(
    role.permissions,
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(permissions);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography style={{ flex: 1 }}>{role.name}</Typography>
        <Typography variant="caption" color="textSecondary">
          {permissions.length} permission
          {permissions.length === 1 ? '' : 's'}
        </Typography>
      </AccordionSummary>
      <AccordionDetails style={{ flexDirection: 'column' }}>
        <Typography variant="subtitle2">Permission decisions</Typography>
        <PermissionRuleEditor rules={permissions} onChange={setPermissions} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={handleSave}
            disabled={saving}
          >
            Save permissions
          </Button>
          <Button
            size="small"
            color="secondary"
            onClick={onDelete}
            disabled={saving}
          >
            Delete role
          </Button>
        </div>
        <Divider style={{ margin: '16px 0' }} />
        <Typography variant="subtitle2" gutterBottom>
          Bindings
        </Typography>
        <BindingsTable role={role.name} />
      </AccordionDetails>
    </Accordion>
  );
}

/**
 * Props for {@link PolicyEditor}.
 *
 * @public
 */
export interface PolicyEditorProps {
  policyId: string;
  onClose: () => void;
  onChanged?: () => void;
}

/**
 * Edits a single RBAC policy: its name, resolution strategy, and own rules
 * (when in draft), plus the roles scoped to it and each role's permission
 * decisions.
 */
export function PolicyEditor(props: PolicyEditorProps): React.JSX.Element {
  const { policyId, onClose, onChanged } = props;
  const rbacApi = useApi(rbacApiRef);
  const [refresh, setRefresh] = useState(0);
  const [name, setName] = useState('');
  const [strategy, setStrategy] = useState<RbacPolicyStrategy>('first-match');
  const [rules, setRules] = useState<RbacPolicyRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | undefined>(undefined);

  const {
    value: policy,
    loading,
    error,
  } = useAsync(() => rbacApi.getPolicy(policyId), [rbacApi, policyId, refresh]);

  useEffect(() => {
    if (policy) {
      setName(policy.name);
      setStrategy(policy.strategy);
      setRules(policy.rules);
    }
  }, [policy]);

  const isDraft = policy?.status === 'draft';

  const handleSavePolicy = useCallback(async () => {
    setSaving(true);
    try {
      await rbacApi.updatePolicy(policyId, { name, strategy, rules });
      setRefresh(r => r + 1);
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }, [rbacApi, policyId, name, strategy, rules, onChanged]);

  const handlePublish = useCallback(async () => {
    setSaving(true);
    try {
      await rbacApi.publishPolicy(policyId);
      setRefresh(r => r + 1);
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }, [rbacApi, policyId, onChanged]);

  const handleRepublish = useCallback(async () => {
    setSaving(true);
    try {
      const draft = await rbacApi.republishPolicy(policyId);
      onChanged?.();
      setNotice(
        `Created a new draft ('${draft.name}') from this policy. Close this editor and open the new draft from the policy list to continue editing it.`,
      );
    } finally {
      setSaving(false);
    }
  }, [rbacApi, policyId, onChanged]);

  const handleSaveRole = useCallback(
    async (input: {
      name: string;
      description: string;
      permissions: RbacPolicyRule[];
    }) => {
      await rbacApi.createRole(input);
      await rbacApi.updateRole(input.name, { policyId });
      setRefresh(r => r + 1);
      onChanged?.();
    },
    [rbacApi, policyId, onChanged],
  );

  const handleSaveRolePermissions = useCallback(
    async (role: RbacRole, permissions: RbacPolicyRule[]) => {
      await rbacApi.updateRole(role.name, { permissions });
      setRefresh(r => r + 1);
      onChanged?.();
    },
    [rbacApi, onChanged],
  );

  const handleDeleteRole = useCallback(
    async (role: RbacRole) => {
      await rbacApi.deleteRole(role.name);
      setRefresh(r => r + 1);
      onChanged?.();
    },
    [rbacApi, onChanged],
  );

  return (
    <>
      <DialogTitle>
        Policy: {policy?.name ?? policyId}{' '}
        {policy && <PolicyStatusBadge status={policy.status} />}
      </DialogTitle>
      <DialogContent>
        {loading && <Progress />}
        {error && (
          <Typography color="error">
            Failed to load policy: {error.message}
          </Typography>
        )}
        {notice && (
          <Typography color="primary" gutterBottom>
            {notice}
          </Typography>
        )}
        {policy && (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <TextField
                label="Name"
                value={name}
                onChange={e => setName(e.target.value)}
                margin="normal"
                style={{ flex: 1 }}
                disabled={!isDraft}
              />
              <TextField
                select
                label="Resolution strategy"
                value={strategy}
                onChange={e =>
                  setStrategy(e.target.value as RbacPolicyStrategy)
                }
                margin="normal"
                style={{ width: 200 }}
                disabled={!isDraft}
              >
                <MenuItem value="first-match">first-match</MenuItem>
                <MenuItem value="any-allow">any-allow</MenuItem>
              </TextField>
            </div>
            {!isDraft && (
              <Typography variant="caption" color="textSecondary">
                Only draft policies can be edited. Republish this policy to
                create an editable draft.
              </Typography>
            )}

            <Typography variant="subtitle1" style={{ marginTop: 16 }}>
              Policy rules
            </Typography>
            <PermissionRuleEditor
              rules={rules}
              onChange={setRules}
              disabled={!isDraft}
            />

            {isDraft && (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSavePolicy}
                disabled={saving || !name}
                style={{ marginTop: 8 }}
              >
                Save policy
              </Button>
            )}

            <Divider style={{ margin: '24px 0' }} />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="subtitle1">Roles</Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setRoleDialogOpen(true)}
              >
                Add role
              </Button>
            </div>
            {policy.roles.length === 0 && (
              <Typography variant="body2" color="textSecondary">
                No roles are scoped to this policy yet.
              </Typography>
            )}
            {policy.roles.map(role => (
              <RolePanel
                key={role.name}
                role={role}
                onSave={permissions =>
                  handleSaveRolePermissions(role, permissions)
                }
                onDelete={() => handleDeleteRole(role)}
              />
            ))}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {policy?.status === 'draft' && (
          <Button onClick={handlePublish} disabled={saving} color="primary">
            Publish
          </Button>
        )}
        {policy?.status === 'inactive' && (
          <Button onClick={handleRepublish} disabled={saving} color="primary">
            Republish as draft
          </Button>
        )}
        {saving && <CircularProgress size={20} />}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      <RoleEditDialog
        open={roleDialogOpen}
        onClose={() => setRoleDialogOpen(false)}
        onSave={handleSaveRole}
      />
    </>
  );
}
