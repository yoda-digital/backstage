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

import React, { useCallback, useRef, useState } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { useApi } from '@backstage/core-plugin-api';
import { RbacPolicyRecord } from '@backstage/plugin-rbac-common';
import { rbacApiRef } from '../api/ref';

/**
 * A minimal, dependency-free structural check of a policy YAML document: it
 * looks for a top-level `name:` mapping key, which every importable policy
 * document must have. It intentionally does not attempt to fully parse
 * YAML; the backend import endpoint is the source of truth for validity and
 * is what actually runs on submit.
 */
function looksLikeValidPolicyYaml(content: string): string | undefined {
  if (!content.trim()) {
    return 'The document is empty';
  }
  if (!/^\s*name\s*:\s*\S+/m.test(content)) {
    return "The document is missing a top-level 'name' field";
  }
  return undefined;
}

/**
 * Props for {@link YamlImportDialog}.
 *
 * @public
 */
export interface YamlImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported?: (policy: RbacPolicyRecord) => void;
}

/**
 * A dialog for importing a policy from a pasted or uploaded YAML document,
 * as produced by the policy export endpoint.
 */
export function YamlImportDialog(
  props: YamlImportDialogProps,
): React.JSX.Element {
  const { open, onClose, onImported } = props;
  const rbacApi = useApi(rbacApiRef);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState('');
  const [validation, setValidation] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [importing, setImporting] = useState(false);

  const reset = useCallback(() => {
    setContent('');
    setValidation(undefined);
    setError(undefined);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setContent(String(reader.result ?? ''));
      setValidation(undefined);
      setError(undefined);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleValidate = () => {
    const issue = looksLikeValidPolicyYaml(content);
    setValidation(issue ?? 'The document looks structurally valid');
  };

  const handleImport = async () => {
    setImporting(true);
    setError(undefined);
    try {
      const policy = await rbacApi.importPolicy(content);
      onImported?.(policy);
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Import policy from YAML</DialogTitle>
      <DialogContent>
        <Button component="label" size="small">
          Choose file
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml,text/yaml"
            hidden
            onChange={handleFileChange}
          />
        </Button>
        <TextField
          label="Policy YAML"
          value={content}
          onChange={e => {
            setContent(e.target.value);
            setValidation(undefined);
          }}
          multiline
          minRows={12}
          fullWidth
          margin="normal"
          variant="outlined"
          placeholder={
            'name: my-policy\nstrategy: first-match\nrules:\n  - permission: catalog.entity.read\n    action: allow\n'
          }
        />
        {validation && (
          <Typography
            variant="body2"
            color={
              validation === 'The document looks structurally valid'
                ? 'primary'
                : 'error'
            }
          >
            {validation}
          </Typography>
        )}
        {error && (
          <Typography color="error" variant="body2">
            Import failed: {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={importing}>
          Cancel
        </Button>
        <Button onClick={handleValidate} disabled={importing || !content}>
          Validate
        </Button>
        <Button
          color="primary"
          variant="contained"
          onClick={handleImport}
          disabled={importing || !content}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}
