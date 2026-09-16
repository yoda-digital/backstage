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

import React, { useState } from 'react';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Chip from '@material-ui/core/Chip';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { ContentHeader, Table, TableColumn } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/esm/useAsync';
import {
  RbacPolicyTestChainEntry,
  RbacPolicyTestResult,
  rbacApiRef,
} from '../api/ref';

const DECISION_COLORS: Record<string, { background: string; color: string }> = {
  ALLOW: { background: '#e8f5e9', color: '#1b5e20' },
  DENY: { background: '#ffebee', color: '#b71c1c' },
  CONDITIONAL: { background: '#fff8e1', color: '#e65100' },
};

function DecisionChip(props: { decision: string }): React.JSX.Element {
  const colors = DECISION_COLORS[props.decision] ?? {
    background: '#eeeeee',
    color: '#424242',
  };
  return (
    <Chip
      label={props.decision}
      style={{
        backgroundColor: colors.background,
        color: colors.color,
        fontWeight: 700,
      }}
    />
  );
}

/**
 * A form for simulating a permission request against a policy, showing the
 * resulting decision, the matched role and rule (if any), and the full
 * evaluation chain considered along the way.
 */
export function PolicyTester(): React.JSX.Element {
  const rbacApi = useApi(rbacApiRef);
  const { value: policies } = useAsync(() => rbacApi.listPolicies(), [rbacApi]);

  const [policyId, setPolicyId] = useState('');
  const [userRef, setUserRef] = useState('');
  const [permission, setPermission] = useState('');
  const [resourceRef, setResourceRef] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<RbacPolicyTestResult | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | undefined>(undefined);

  const selectedPolicyId = policyId || policies?.[0]?.id || '';

  const handleTest = async () => {
    setTesting(true);
    setError(undefined);
    try {
      const testResult = await rbacApi.testPolicy(selectedPolicyId, {
        userRef,
        permission,
        resourceRef: resourceRef || undefined,
      });
      setResult(testResult);
    } catch (e) {
      setResult(undefined);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  const chainColumns: TableColumn<RbacPolicyTestChainEntry>[] = [
    { title: 'Source', field: 'source' },
    { title: 'Permission', render: row => row.rule.permission },
    { title: 'Action', render: row => row.rule.action },
    {
      title: 'Conditions',
      render: row => (row.rule.conditions?.length ? 'yes' : 'no'),
    },
    { title: 'Matched', render: row => (row.matched ? 'yes' : 'no') },
    { title: 'Decision', render: row => row.decision ?? '-' },
  ];

  return (
    <div>
      <ContentHeader title="Policy tester">
        <Typography variant="body2" color="textSecondary">
          Simulate a permission request against a policy without waiting for it
          to be published.
        </Typography>
      </ContentHeader>
      <Card>
        <CardContent>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <TextField
              select
              label="Policy"
              value={selectedPolicyId}
              onChange={e => setPolicyId(e.target.value)}
              margin="dense"
              style={{ minWidth: 240 }}
            >
              {(policies ?? []).map(policy => (
                <MenuItem key={policy.id} value={policy.id}>
                  {policy.name} ({policy.status})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="User ref"
              placeholder="user:default/jdoe"
              value={userRef}
              onChange={e => setUserRef(e.target.value)}
              margin="dense"
              style={{ minWidth: 220 }}
            />
            <TextField
              label="Permission"
              placeholder="catalog.entity.read"
              value={permission}
              onChange={e => setPermission(e.target.value)}
              margin="dense"
              style={{ minWidth: 220 }}
            />
            <TextField
              label="Entity ref (optional)"
              placeholder="component:default/my-service"
              value={resourceRef}
              onChange={e => setResourceRef(e.target.value)}
              margin="dense"
              style={{ minWidth: 240 }}
            />
          </div>
          <Button
            variant="contained"
            color="primary"
            onClick={handleTest}
            disabled={testing || !selectedPolicyId || !userRef || !permission}
            style={{ marginTop: 8 }}
          >
            Test
          </Button>
          {error && (
            <Typography color="error" style={{ marginTop: 8 }}>
              {error}
            </Typography>
          )}
        </CardContent>
      </Card>

      {result && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <DecisionChip decision={result.decision} />
            <Typography variant="body2">
              Matched role: {result.matchedRole ?? 'none (policy-level rule)'}
            </Typography>
            <Typography variant="body2">
              Matched rule:{' '}
              {result.matchedRule
                ? `${result.matchedRule.permission} (${result.matchedRule.action})`
                : 'none'}
            </Typography>
          </div>
          <Table
            title="Evaluation chain"
            columns={chainColumns}
            data={result.evaluationChain}
            options={{ paging: false, search: false }}
            style={{ marginTop: 16 }}
          />
        </div>
      )}
    </div>
  );
}
