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

import { useApi } from '@backstage/core-plugin-api';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Alert from '@material-ui/lab/Alert';
import { ChangeEvent, useState } from 'react';
import { parse } from 'yaml';
import { soundcheckApiRef } from '../api/ref';
import { soundcheckTranslationRef } from '../translation';

/** Which kind of Soundcheck definition an {@link ImportDialog} imports. */
export type ImportDialogKind = 'checks' | 'tracks';

interface ValidationState {
  entryCount: number;
  duplicateCount: number;
  error?: string;
}

interface ImportResultState {
  createdCount: number;
  skippedCount: number;
}

function extractIds(parsed: unknown, key: string): string[] {
  let entries: unknown;
  if (Array.isArray(parsed)) {
    entries = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    entries = (parsed as Record<string, unknown>)[key];
  }
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .map(entry =>
      typeof entry === 'object' && entry !== null
        ? (entry as Record<string, unknown>).id
        : undefined,
    )
    .filter((id): id is string => typeof id === 'string');
}

/**
 * Props for {@link ImportDialog}.
 *
 * @public
 */
export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Whether this dialog imports checks or tracks. */
  kind: ImportDialogKind;
  /** Called after a successful import (including a partial one). */
  onImported?: () => void;
}

/**
 * Dialog for importing Soundcheck checks or tracks from a YAML file:
 * uploads the file, validates it client-side (entry count, duplicate id
 * detection against existing definitions), and on confirmation posts it to
 * the backend's YAML import endpoint, surfacing the resulting
 * created/skipped partial-failure report.
 *
 * @public
 */
export function ImportDialog(props: ImportDialogProps) {
  const { open, onClose, kind, onImported } = props;
  const api = useApi(soundcheckApiRef);
  const { t } = useTranslationRef(soundcheckTranslationRef);

  const [fileName, setFileName] = useState<string>();
  const [content, setContent] = useState<string>();
  const [validation, setValidation] = useState<ValidationState>();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResultState>();

  function reset() {
    setFileName(undefined);
    setContent(undefined);
    setValidation(undefined);
    setResult(undefined);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setResult(undefined);
    setFileName(file.name);
    const text = await file.text();
    setContent(text);

    try {
      const parsed = parse(text);
      const ids = extractIds(parsed, kind);
      const existing = new Set(
        kind === 'checks'
          ? (await api.getChecks()).map(c => c.id)
          : (await api.getTracks()).map(tr => tr.id),
      );
      const duplicateCount = ids.filter(id => existing.has(id)).length;
      setValidation({ entryCount: ids.length, duplicateCount });
    } catch (e) {
      setValidation({
        entryCount: 0,
        duplicateCount: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function handleImport() {
    if (!content) {
      return;
    }
    setImporting(true);
    try {
      if (kind === 'checks') {
        const report = await api.importChecks(content);
        setResult({
          createdCount: report.created.length,
          skippedCount: report.skipped.length,
        });
      } else {
        const report = await api.importTracks(content);
        setResult({
          createdCount: report.created.length,
          skippedCount: report.skipped.length,
        });
      }
      onImported?.();
    } finally {
      setImporting(false);
    }
  }

  const title =
    kind === 'checks'
      ? t('importDialog.titleChecks')
      : t('importDialog.titleTracks');

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box display="flex" alignItems="center" gridGap={8} mb={2}>
          <Button variant="outlined" component="label">
            {t('importDialog.selectFileButton')}
            <input
              type="file"
              accept=".yaml,.yml,text/yaml"
              hidden
              onChange={handleFileSelected}
            />
          </Button>
          <Typography variant="body2" color="textSecondary">
            {fileName ?? t('importDialog.noFileSelected')}
          </Typography>
        </Box>

        {validation?.error && (
          <Alert severity="error">
            {t('importDialog.parseError', { error: validation.error })}
          </Alert>
        )}

        {validation && !validation.error && (
          <>
            <Alert severity="info">
              {t('importDialog.entriesFound', {
                count: validation.entryCount,
              })}
            </Alert>
            {validation.duplicateCount > 0 && (
              <Box mt={1}>
                <Alert severity="warning">
                  {t('importDialog.duplicateWarning', {
                    count: validation.duplicateCount,
                  })}
                </Alert>
              </Box>
            )}
          </>
        )}

        {result && (
          <Box mt={2}>
            <Alert severity="success">
              {t('importDialog.resultSummary', {
                created: String(result.createdCount),
                skipped: String(result.skippedCount),
              })}
            </Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('importDialog.cancelButton')}</Button>
        <Button
          color="primary"
          variant="contained"
          disabled={!content || Boolean(validation?.error) || importing}
          onClick={handleImport}
        >
          {t('importDialog.importButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
