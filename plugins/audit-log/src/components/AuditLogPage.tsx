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

import { useMemo, useState } from 'react';
import useAsync from 'react-use/esm/useAsync';
import useDebounce from 'react-use/esm/useDebounce';
import { Grid, MenuItem, TextField } from '@material-ui/core';
import Chip from '@material-ui/core/Chip';
import {
  Content,
  Header,
  Page,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { AuditEvent, AuditSeverity } from '@backstage/plugin-audit-log-common';
import { auditLogApiRef } from '../api/ref';
import { auditLogTranslationRef } from '../translation';

const ACTION_OPTIONS = [
  'create',
  'update',
  'delete',
  'read',
  'login',
  'logout',
];

const SEVERITY_OPTIONS: AuditSeverity[] = ['low', 'medium', 'high', 'critical'];

const SEVERITY_COLORS: Record<AuditSeverity, string> = {
  low: '#9e9e9e',
  medium: '#2196f3',
  high: '#ff9800',
  critical: '#f44336',
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 20;

function SeverityChip(props: { severity: AuditSeverity }): JSX.Element {
  return (
    <Chip
      label={props.severity}
      size="small"
      style={{
        backgroundColor: SEVERITY_COLORS[props.severity],
        color: '#fff',
      }}
    />
  );
}

const columns: TableColumn<AuditEvent>[] = [
  {
    title: 'Timestamp',
    field: 'timestamp',
    render: row => new Date(row.timestamp).toLocaleString(),
  },
  {
    title: 'Severity',
    field: 'severity',
    render: row => <SeverityChip severity={row.severity} />,
  },
  {
    title: 'Plugin',
    field: 'pluginId',
  },
  {
    title: 'Action',
    field: 'action',
  },
  {
    title: 'Actor',
    field: 'actor',
  },
  {
    title: 'Entity',
    field: 'entityRef',
    render: row => row.entityRef ?? '-',
  },
  {
    title: 'Status',
    field: 'status',
  },
];

/**
 * A page that lists audit log events with filtering and pagination.
 *
 * @public
 */
export function AuditLogPage() {
  const { t } = useTranslationRef(auditLogTranslationRef);
  const auditLogApi = useApi(auditLogApiRef);

  const [actorInput, setActorInput] = useState('');
  const [entityRefInput, setEntityRefInput] = useState('');
  const [actor, setActor] = useState('');
  const [entityRef, setEntityRef] = useState('');
  const [action, setAction] = useState('');
  const [severity, setSeverity] = useState<AuditSeverity | ''>('');
  const [pluginId, setPluginId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  useDebounce(() => setActor(actorInput), 300, [actorInput]);
  useDebounce(() => setEntityRef(entityRefInput), 300, [entityRefInput]);

  const { value, loading, error } = useAsync(
    async () =>
      auditLogApi.queryEvents({
        actor: actor || undefined,
        entityRef: entityRef || undefined,
        action: action || undefined,
        severity: severity || undefined,
        pluginId: pluginId || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: pageSize,
        offset: page * pageSize,
      }),
    [
      auditLogApi,
      actor,
      entityRef,
      action,
      severity,
      pluginId,
      from,
      to,
      page,
      pageSize,
    ],
  );

  const pluginOptions = useMemo(
    () =>
      Array.from(new Set((value?.events ?? []).map(event => event.pluginId)))
        .filter(Boolean)
        .sort(),
    [value],
  );

  if (error) {
    return (
      <Page themeId="tool">
        <Header title={t('page.title')} />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title={t('page.title')} subtitle={t('page.subtitle')} />
      <Content>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label={t('page.actorLabel')}
              fullWidth
              value={actorInput}
              onChange={event => {
                setActorInput(event.target.value);
                setPage(0);
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              select
              label={t('page.actionLabel')}
              fullWidth
              value={action}
              onChange={event => {
                setAction(event.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="">{t('page.allActionsOption')}</MenuItem>
              {ACTION_OPTIONS.map(option => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              select
              label={t('page.severityLabel')}
              fullWidth
              value={severity}
              onChange={event => {
                setSeverity(event.target.value as AuditSeverity | '');
                setPage(0);
              }}
            >
              <MenuItem value="">{t('page.allSeveritiesOption')}</MenuItem>
              {SEVERITY_OPTIONS.map(option => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              select
              label={t('page.pluginLabel')}
              fullWidth
              value={pluginId}
              onChange={event => {
                setPluginId(event.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="">{t('page.allPluginsOption')}</MenuItem>
              {pluginOptions.map(option => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label={t('page.entityRefLabel')}
              fullWidth
              value={entityRefInput}
              onChange={event => {
                setEntityRefInput(event.target.value);
                setPage(0);
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label={t('page.fromLabel')}
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={event => {
                setFrom(event.target.value);
                setPage(0);
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label={t('page.toLabel')}
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={event => {
                setTo(event.target.value);
                setPage(0);
              }}
            />
          </Grid>
        </Grid>
        <Table
          isLoading={loading}
          columns={columns}
          data={value?.events ?? []}
          page={page}
          totalCount={value?.totalCount ?? 0}
          onPageChange={setPage}
          onRowsPerPageChange={size => {
            setPageSize(size);
            setPage(0);
          }}
          options={{
            paging: true,
            pageSize,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            search: false,
            sorting: false,
            padding: 'dense',
          }}
          emptyContent={<div>{t('page.emptyContent')}</div>}
        />
      </Content>
    </Page>
  );
}
