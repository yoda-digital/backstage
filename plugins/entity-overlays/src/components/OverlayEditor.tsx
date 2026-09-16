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
import useAsyncRetry from 'react-use/lib/useAsyncRetry';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import FormControl from '@material-ui/core/FormControl';
import Grid from '@material-ui/core/Grid';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import Select, { SelectProps } from '@material-ui/core/Select';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { useApi } from '@backstage/core-plugin-api';
import {
  EmptyState,
  InfoCard,
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { OverlayPatch } from '@backstage/plugin-entity-overlays-common';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { overlayApiRef } from '../api/ref';
import { entityOverlaysTranslationRef } from '../translation';

type OverlayKind = 'annotation' | 'label';
type OverlayOp = 'add' | 'remove';

const LIFECYCLE_OPTIONS = ['production', 'experimental', 'deprecated'];

/**
 * Folds the `metadata.tags` patches in a patch list, in order, into the
 * resulting tag list.
 */
function deriveTags(patches: OverlayPatch[]): string[] {
  let tags: string[] = [];
  for (const patch of patches) {
    if (patch.path !== 'metadata.tags') {
      continue;
    }
    if (patch.op === 'replace' && Array.isArray(patch.value)) {
      tags = patch.value as string[];
    } else if (patch.op === 'add') {
      const tag = patch.value as string;
      if (!tags.includes(tag)) {
        tags = [...tags, tag];
      }
    } else if (patch.op === 'remove') {
      const tag = patch.value as string | undefined;
      tags = tag === undefined ? [] : tags.filter(t => t !== tag);
    }
  }
  return tags;
}

/**
 * Folds the `spec.lifecycle` patches in a patch list, in order, into the
 * resulting lifecycle value.
 */
function deriveLifecycle(patches: OverlayPatch[]): string {
  let lifecycle = '';
  for (const patch of patches) {
    if (patch.path !== 'spec.lifecycle') {
      continue;
    }
    lifecycle = patch.op === 'remove' ? '' : (patch.value as string) ?? '';
  }
  return lifecycle;
}

interface PatchRow {
  path: string;
  kind: OverlayKind | undefined;
  key: string;
  op: OverlayPatch['op'];
  value: string;
}

function escapeJsonPointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function unescapeJsonPointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function buildPath(kind: OverlayKind, key: string): string {
  const field = kind === 'annotation' ? 'annotations' : 'labels';
  return `/metadata/${field}/${escapeJsonPointerSegment(key)}`;
}

function describePath(path: string): {
  kind: OverlayKind | undefined;
  key: string;
} {
  const match = path.match(/^\/metadata\/(annotations|labels)\/(.+)$/);
  if (!match) {
    return { kind: undefined, key: path };
  }
  const [, field, rawKey] = match;
  return {
    kind: field === 'annotations' ? 'annotation' : 'label',
    key: unescapeJsonPointerSegment(rawKey),
  };
}

function toRow(patch: OverlayPatch): PatchRow {
  const { kind, key } = describePath(patch.path);
  return {
    path: patch.path,
    kind,
    key,
    op: patch.op,
    value: patch.value === undefined ? '' : String(patch.value),
  };
}

/**
 * Displays and edits the entity overlay patches for the current entity.
 * @public
 */
export function OverlayEditor() {
  const { t } = useTranslationRef(entityOverlaysTranslationRef);
  const { entity } = useEntity();
  const overlayApi = useApi(overlayApiRef);
  const entityRef = stringifyEntityRef(entity);

  const [patches, setPatches] = useState<OverlayPatch[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | undefined>(undefined);

  const [kind, setKind] = useState<OverlayKind>('annotation');
  const [op, setOp] = useState<OverlayOp>('add');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [newTag, setNewTag] = useState('');

  const { loading, error, retry } = useAsyncRetry(async () => {
    const overlay = await overlayApi.getOverlay(entityRef);
    setPatches(overlay?.patches ?? []);
    return overlay;
  }, [entityRef]);

  const tags = useMemo(() => deriveTags(patches), [patches]);
  const lifecycle = useMemo(() => deriveLifecycle(patches), [patches]);

  function handleAddTag() {
    const trimmed = newTag.trim();
    if (!trimmed || tags.includes(trimmed)) {
      return;
    }
    const nextTags = [...tags, trimmed];
    setPatches(prev => [
      ...prev.filter(p => p.path !== 'metadata.tags'),
      { path: 'metadata.tags', op: 'replace', value: nextTags },
    ]);
    setNewTag('');
  }

  function handleRemoveTag(tag: string) {
    const nextTags = tags.filter(item => item !== tag);
    setPatches(prev => {
      const rest = prev.filter(p => p.path !== 'metadata.tags');
      return nextTags.length > 0
        ? [...rest, { path: 'metadata.tags', op: 'replace', value: nextTags }]
        : rest;
    });
  }

  function handleLifecycleChange(next: string) {
    setPatches(prev => {
      const rest = prev.filter(p => p.path !== 'spec.lifecycle');
      return next
        ? [...rest, { path: 'spec.lifecycle', op: 'replace', value: next }]
        : rest;
    });
  }

  function handleUpsertPatch() {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      return;
    }
    const path = buildPath(kind, trimmedKey);
    const patch: OverlayPatch =
      op === 'remove' ? { path, op: 'remove' } : { path, op: 'add', value };
    setPatches(prev => [...prev.filter(p => p.path !== path), patch]);
    setKey('');
    setValue('');
  }

  function handleEditRow(row: PatchRow) {
    if (row.kind) {
      setKind(row.kind);
    }
    setOp(row.op === 'remove' ? 'remove' : 'add');
    setKey(row.key);
    setValue(row.value);
  }

  function handleRemoveRow(row: PatchRow) {
    setPatches(prev => prev.filter(p => p.path !== row.path));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(undefined);
    try {
      await overlayApi.setOverlay(entityRef, patches);
      retry();
    } catch (e) {
      setSaveError(e as Error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAll() {
    setSaving(true);
    setSaveError(undefined);
    try {
      await overlayApi.deleteOverlay(entityRef);
      setPatches([]);
    } catch (e) {
      setSaveError(e as Error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  const rows = patches
    .filter(p => p.path !== 'metadata.tags' && p.path !== 'spec.lifecycle')
    .map(toRow);
  const columns: TableColumn<PatchRow>[] = [
    { title: 'Type', field: 'kind', render: row => row.kind ?? '—' },
    { title: 'Key', field: 'key' },
    { title: 'Operation', field: 'op' },
    { title: 'Value', field: 'value' },
    {
      title: 'Actions',
      sorting: false,
      render: row => (
        <Box display="flex" style={{ gap: 8 }}>
          <Button size="small" onClick={() => handleEditRow(row)}>
            Edit
          </Button>
          <Button size="small" onClick={() => handleRemoveRow(row)}>
            Remove
          </Button>
        </Box>
      ),
    },
  ];

  return (
    <Grid container spacing={3} direction="column">
      <Grid item>
        <InfoCard title={t('editor.tagsTitle')}>
          <Box display="flex" flexWrap="wrap" style={{ gap: 8 }} mb={2}>
            {tags.length === 0 ? (
              <Typography color="textSecondary">
                No tag overrides. The entity's source-provided tags are used
                as-is.
              </Typography>
            ) : (
              tags.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onDelete={() => handleRemoveTag(tag)}
                />
              ))
            )}
          </Box>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <TextField
              label="Add tag"
              size="small"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleAddTag();
                }
              }}
            />
            <Button
              variant="outlined"
              color="primary"
              disabled={!newTag.trim()}
              onClick={handleAddTag}
            >
              Add
            </Button>
          </Box>
        </InfoCard>
      </Grid>
      <Grid item>
        <InfoCard title={t('editor.lifecycleTitle')}>
          <FormControl style={{ minWidth: 220 }}>
            <InputLabel id="overlay-lifecycle-label">Lifecycle</InputLabel>
            <Select
              labelId="overlay-lifecycle-label"
              value={lifecycle}
              onChange={
                (e =>
                  handleLifecycleChange(
                    e.target.value as string,
                  )) as SelectProps['onChange']
              }
            >
              <MenuItem value="">
                <em>No override</em>
              </MenuItem>
              {LIFECYCLE_OPTIONS.map(option => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </InfoCard>
      </Grid>
      <Grid item>
        <InfoCard title={t('editor.currentPatchesTitle')}>
          {rows.length === 0 ? (
            <EmptyState
              missing="data"
              title={t('editor.noPatchesTitle')}
              description={t('editor.noPatchesDescription')}
            />
          ) : (
            <Table
              options={{ paging: false, search: false, padding: 'dense' }}
              columns={columns}
              data={rows}
            />
          )}
        </InfoCard>
      </Grid>
      <Grid item>
        <InfoCard title={t('editor.addPatchTitle')}>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel id="overlay-kind-label">Type</InputLabel>
                <Select
                  labelId="overlay-kind-label"
                  value={kind}
                  onChange={
                    (e =>
                      setKind(
                        e.target.value as OverlayKind,
                      )) as SelectProps['onChange']
                  }
                >
                  <MenuItem value="annotation">Annotation</MenuItem>
                  <MenuItem value="label">Label</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel id="overlay-op-label">Operation</InputLabel>
                <Select
                  labelId="overlay-op-label"
                  value={op}
                  onChange={
                    (e =>
                      setOp(
                        e.target.value as OverlayOp,
                      )) as SelectProps['onChange']
                  }
                >
                  <MenuItem value="add">Set value</MenuItem>
                  <MenuItem value="remove">Remove</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Key"
                value={key}
                onChange={e => setKey(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Value"
                value={value}
                disabled={op === 'remove'}
                onChange={e => setValue(e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                color="primary"
                disabled={!key.trim()}
                onClick={handleUpsertPatch}
              >
                Add to overlay
              </Button>
            </Grid>
          </Grid>
        </InfoCard>
      </Grid>
      {saveError && (
        <Grid item>
          <ResponseErrorPanel error={saveError} />
        </Grid>
      )}
      <Grid item>
        <Box display="flex" style={{ gap: 8 }}>
          <Button
            variant="contained"
            color="primary"
            disabled={saving}
            onClick={handleSave}
          >
            {t('editor.saveButton')}
          </Button>
          <Button
            variant="outlined"
            disabled={saving || rows.length === 0}
            onClick={handleDeleteAll}
          >
            {t('editor.deleteAllButton')}
          </Button>
        </Box>
      </Grid>
      <Grid item>
        <Typography variant="body2" color="textSecondary">
          {t('editor.footerNote')}
        </Typography>
      </Grid>
    </Grid>
  );
}
