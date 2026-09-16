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

import { useState } from 'react';
import {
  Button,
  Chip,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import useAsync from 'react-use/esm/useAsync';
import { useApi } from '@backstage/core-plugin-api';
import {
  InfoCard,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { scaffolderApiRef } from '@backstage/plugin-scaffolder-react';
import { ActionStep, FormField } from '../types';

function newStepId(): string {
  return `step-${Math.random().toString(36).slice(2, 8)}`;
}

function formatInput(input: Record<string, unknown>): string {
  return JSON.stringify(input, null, 2);
}

/**
 * A step builder that lists available scaffolder actions and lets the user
 * configure the `steps` section of a template.
 *
 * @public
 */
export function ActionConfigurator(props: {
  steps: ActionStep[];
  onChange: (steps: ActionStep[]) => void;
  formFields: FormField[];
}): JSX.Element {
  const { steps, onChange, formFields } = props;
  const scaffolderApi = useApi(scaffolderApiRef);
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});

  const {
    value: actions,
    loading,
    error,
  } = useAsync(() => scaffolderApi.listActions(), [scaffolderApi]);

  function addStep(): void {
    onChange([
      ...steps,
      {
        id: newStepId(),
        name: '',
        action: actions?.[0]?.id ?? '',
        input: {},
      },
    ]);
  }

  function updateStep(index: number, patch: Partial<ActionStep>): void {
    onChange(
      steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    );
  }

  function updateStepInputText(index: number, text: string): void {
    try {
      const parsed = text.trim() === '' ? {} : JSON.parse(text);
      updateStep(index, { input: parsed });
      setInputErrors(prev => ({ ...prev, [steps[index].id]: '' }));
    } catch {
      setInputErrors(prev => ({
        ...prev,
        [steps[index].id]: 'Input must be valid JSON',
      }));
    }
  }

  function removeStep(index: number): void {
    onChange(steps.filter((_, i) => i !== index));
  }

  async function copyParameterRef(name: string): Promise<void> {
    const reference = `\${{ parameters.${name} }}`;
    try {
      await window.navigator.clipboard.writeText(reference);
    } catch {
      // Clipboard access may be unavailable; the reference is still shown
      // in the helper text below for manual copying.
    }
  }

  return (
    <InfoCard title="Action Steps">
      {loading && <Progress />}
      {error && <ResponseErrorPanel error={error} />}
      {!loading && !error && (
        <Grid container spacing={2}>
          {formFields.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="body2" color="textSecondary">
                Click a parameter to copy its template reference, then paste it
                into a step's input JSON:
              </Typography>
              {formFields.map(field => (
                <Chip
                  key={field.name}
                  label={`parameters.${field.name}`}
                  onClick={() => copyParameterRef(field.name)}
                  style={{ marginRight: 8, marginTop: 8 }}
                  clickable
                />
              ))}
            </Grid>
          )}
          {steps.map((step, index) => (
            <Grid item xs={12} key={step.id}>
              <Paper variant="outlined" style={{ padding: 16 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      select
                      label="Action"
                      fullWidth
                      required
                      value={step.action}
                      onChange={e =>
                        updateStep(index, { action: e.target.value })
                      }
                    >
                      {(actions ?? []).map(action => (
                        <MenuItem key={action.id} value={action.id}>
                          {action.id}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={10} sm={7}>
                    <TextField
                      label="Step name"
                      fullWidth
                      value={step.name}
                      onChange={e =>
                        updateStep(index, { name: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid item xs={2} sm={1}>
                    <IconButton
                      aria-label="Remove step"
                      onClick={() => removeStep(index)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Input (JSON)"
                      fullWidth
                      multiline
                      minRows={4}
                      error={Boolean(inputErrors[step.id])}
                      helperText={inputErrors[step.id]}
                      defaultValue={formatInput(step.input)}
                      onBlur={e => updateStepInputText(index, e.target.value)}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          ))}
          {steps.length === 0 && (
            <Grid item xs={12}>
              <Typography variant="body2" color="textSecondary">
                No action steps yet. Add one to start building the template's
                steps.
              </Typography>
            </Grid>
          )}
          <Grid item xs={12}>
            <Button onClick={addStep}>Add step</Button>
          </Grid>
        </Grid>
      )}
    </InfoCard>
  );
}
