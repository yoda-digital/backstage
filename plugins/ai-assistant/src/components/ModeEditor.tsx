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

import { useEffect, useState } from 'react';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Grid from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import Slider from '@material-ui/core/Slider';
import Switch from '@material-ui/core/Switch';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { useApi } from '@backstage/core-plugin-api';
import {
  AiMode,
  AiProcessor,
  AiProcessorType,
  ALL_PROCESSOR_TYPES,
  CreateModeRequest,
} from '@backstage/plugin-ai-assistant-common';
import { aiAssistantApiRef } from '../api/AiAssistantClient';

const MODEL_OPTIONS = [
  { value: '', label: 'Use mode default' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet' },
  { value: 'claude-haiku-4-20250514', label: 'Claude Haiku' },
];

const PROCESSOR_LABELS: Record<AiProcessorType, string> = {
  'context-management': 'Context management (trim/compress history)',
  classification: 'Classification (categorize the request)',
  planning: 'Planning (draft an investigation plan)',
  'answer-formatting': 'Answer formatting (structure the response)',
  verification: 'Verification (check quality, retry if needed)',
  'confidence-scoring': 'Confidence scoring (rate low/medium/high)',
};

interface FormState {
  name: string;
  description: string;
  instructions: string;
  visibility: 'private' | 'public';
  modelOverride: string;
  maxSteps: number;
  temperature: number;
  mcpTools: string[];
  enabledProcessors: Set<AiProcessorType>;
}

function initialState(mode: AiMode | undefined): FormState {
  return {
    name: mode?.name ?? '',
    description: mode?.description ?? '',
    instructions: mode?.instructions ?? '',
    visibility: mode?.visibility ?? 'private',
    modelOverride: mode?.modelOverride ?? '',
    maxSteps: mode?.maxSteps ?? 5,
    temperature: mode?.temperature ?? 0.7,
    mcpTools: mode?.mcpTools ?? [],
    enabledProcessors: new Set(
      (mode?.processors ?? [])
        .filter(processor => processor.enabled)
        .map(processor => processor.type),
    ),
  };
}

/**
 * Props for {@link ModeEditor}.
 *
 * @public
 */
export interface ModeEditorProps {
  open: boolean;
  /** The mode to edit, or `undefined` to create a new one. */
  mode?: AiMode;
  onClose: () => void;
  onSaved: (mode: AiMode) => void;
}

/**
 * Form dialog for creating or editing an AiKA mode: its instructions,
 * visibility, model override, step and temperature limits, MCP tool access,
 * and which of the six processors are enabled.
 *
 * @public
 */
export function ModeEditor(props: ModeEditorProps): JSX.Element {
  const { open, mode, onClose, onSaved } = props;
  const aiAssistantApi = useApi(aiAssistantApiRef);

  const [form, setForm] = useState<FormState>(() => initialState(mode));
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      setForm(initialState(mode));
      setErrorMessage(undefined);
    }
  }, [open, mode]);

  function toggleProcessor(type: AiProcessorType) {
    setForm(prev => {
      const next = new Set(prev.enabledProcessors);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return { ...prev, enabledProcessors: next };
    });
  }

  async function handleSave() {
    if (!form.name.trim() || !form.instructions.trim()) {
      setErrorMessage('Name and instructions are required.');
      return;
    }
    setSaving(true);
    setErrorMessage(undefined);
    try {
      const processors: AiProcessor[] = ALL_PROCESSOR_TYPES.map(type => ({
        type,
        enabled: form.enabledProcessors.has(type),
      }));
      const request: CreateModeRequest = {
        name: form.name,
        description: form.description,
        instructions: form.instructions,
        visibility: form.visibility,
        processors,
        mcpTools: form.mcpTools.length > 0 ? form.mcpTools : undefined,
        modelOverride: form.modelOverride || undefined,
        maxSteps: form.maxSteps,
        temperature: form.temperature,
      };
      const saved =
        mode && !mode.builtIn
          ? await aiAssistantApi.updateMode(mode.id, request)
          : await aiAssistantApi.createMode(request);
      onSaved(saved);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode ? 'Edit mode' : 'Create mode'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Name"
              fullWidth
              value={form.name}
              onChange={e =>
                setForm(prev => ({ ...prev, name: e.target.value }))
              }
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Description"
              fullWidth
              value={form.description}
              onChange={e =>
                setForm(prev => ({ ...prev, description: e.target.value }))
              }
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Instructions"
              fullWidth
              multiline
              minRows={4}
              value={form.instructions}
              onChange={e =>
                setForm(prev => ({ ...prev, instructions: e.target.value }))
              }
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.visibility === 'public'}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      visibility: e.target.checked ? 'public' : 'private',
                    }))
                  }
                />
              }
              label={
                form.visibility === 'public'
                  ? 'Public (visible to everyone)'
                  : 'Private (visible only to you)'
              }
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              label="Model override"
              value={form.modelOverride}
              onChange={e =>
                setForm(prev => ({ ...prev, modelOverride: e.target.value }))
              }
            >
              {MODEL_OPTIONS.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={form.mcpTools}
              onChange={(_event, value) =>
                setForm(prev => ({ ...prev, mcpTools: value as string[] }))
              }
              renderInput={params => (
                <TextField
                  {...params}
                  label="MCP tools"
                  placeholder="Add tool"
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography gutterBottom variant="body2">
              Max steps: {form.maxSteps}
            </Typography>
            <Slider
              value={form.maxSteps}
              onChange={(_event, value) =>
                setForm(prev => ({ ...prev, maxSteps: value as number }))
              }
              min={1}
              max={20}
              step={1}
              valueLabelDisplay="auto"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography gutterBottom variant="body2">
              Temperature: {form.temperature.toFixed(1)}
            </Typography>
            <Slider
              value={form.temperature}
              onChange={(_event, value) =>
                setForm(prev => ({ ...prev, temperature: value as number }))
              }
              min={0}
              max={1}
              step={0.1}
              valueLabelDisplay="auto"
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Processors
            </Typography>
            {ALL_PROCESSOR_TYPES.map(type => (
              <FormControlLabel
                key={type}
                control={
                  <Checkbox
                    checked={form.enabledProcessors.has(type)}
                    onChange={() => toggleProcessor(type)}
                  />
                }
                label={PROCESSOR_LABELS[type]}
                style={{ display: 'flex' }}
              />
            ))}
          </Grid>
          {errorMessage && (
            <Grid item xs={12}>
              <Typography color="error" variant="body2">
                {errorMessage}
              </Typography>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button color="primary" onClick={handleSave} disabled={saving}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
