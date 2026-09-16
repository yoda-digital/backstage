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

import { CodeSnippet, StatusError, StatusOK } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { SoundcheckCheck } from '@backstage/plugin-soundcheck-common';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import { useMemo, useState } from 'react';
import YAML from 'yaml';
import { SoundcheckDryRunResult, soundcheckApiRef } from '../../api/ref';
import { CheckDraft, draftToCheck } from './types';

/**
 * Props for {@link ReviewAndTest}.
 *
 * @public
 */
export interface ReviewAndTestProps {
  draft: CheckDraft;
  onSaved?: (check: SoundcheckCheck) => void;
}

/**
 * Final step of the {@link CheckBuilderWizard} — shows a read-only YAML
 * preview of the assembled check, lets the author dry-run it against a
 * single entity without persisting anything, and saves the check once
 * they're satisfied.
 *
 * @public
 */
export function ReviewAndTest(props: ReviewAndTestProps) {
  const { draft, onSaved } = props;
  const api = useApi(soundcheckApiRef);

  const check = useMemo(() => draftToCheck(draft), [draft]);
  const yaml = useMemo(() => YAML.stringify(check), [check]);

  const [entityRef, setEntityRef] = useState('');
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunError, setDryRunError] = useState<Error | undefined>();
  const [dryRunResult, setDryRunResult] = useState<
    SoundcheckDryRunResult | undefined
  >();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | undefined>();
  const [saved, setSaved] = useState(false);

  async function handleDryRun() {
    setDryRunLoading(true);
    setDryRunError(undefined);
    try {
      const result = await api.dryRunCheck(check, entityRef);
      setDryRunResult(result);
    } catch (e) {
      setDryRunError(e as Error);
      setDryRunResult(undefined);
    } finally {
      setDryRunLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(undefined);
    try {
      const savedCheck = await api.saveCheck(check);
      setSaved(true);
      onSaved?.(savedCheck);
    } catch (e) {
      setSaveError(e as Error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box display="flex" flexDirection="column" gridGap={24}>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          YAML preview
        </Typography>
        <CodeSnippet
          text={yaml}
          language="yaml"
          showLineNumbers
          showCopyCodeButton
        />
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Dry run
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={8}>
            <TextField
              fullWidth
              size="small"
              label="Entity reference"
              placeholder="component:default/my-service"
              value={entityRef}
              onChange={event => setEntityRef(event.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              startIcon={<PlayArrowIcon />}
              disabled={!entityRef || dryRunLoading}
              onClick={handleDryRun}
            >
              Run check
            </Button>
          </Grid>
        </Grid>

        {dryRunError && (
          <Typography color="error">{dryRunError.message}</Typography>
        )}

        {dryRunResult && (
          <Box mt={2}>
            <Box display="flex" alignItems="center" gridGap={8}>
              {dryRunResult.status === 'pass' ? <StatusOK /> : <StatusError />}
              <Typography variant="body1">
                Result: <strong>{dryRunResult.status}</strong>
              </Typography>
            </Box>
            {dryRunResult.message && (
              <Typography color="textSecondary">
                {dryRunResult.message}
              </Typography>
            )}
            <List dense disablePadding>
              {dryRunResult.breakdown.map((condition, index) => (
                <ListItem key={`${condition.path}-${index}`} disableGutters>
                  <ListItemIcon>
                    {condition.passed ? <StatusOK /> : <StatusError />}
                  </ListItemIcon>
                  <ListItemText
                    primary={`${condition.path ?? '(check fact root)'} ${
                      condition.operator
                    } ${JSON.stringify(condition.expected)}`}
                    secondary={`Actual: ${JSON.stringify(condition.actual)}`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Box>

      <Divider />

      <Box display="flex" alignItems="center" gridGap={16}>
        <Button
          variant="contained"
          color="primary"
          disabled={saving || !draft.name || !draft.factRef}
          onClick={handleSave}
        >
          {draft.id ? 'Save changes' : 'Create check'}
        </Button>
        {saveError && (
          <Typography color="error">{saveError.message}</Typography>
        )}
        {saved && !saveError && (
          <Typography color="primary">Check saved.</Typography>
        )}
      </Box>
    </Box>
  );
}
