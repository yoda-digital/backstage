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

import {
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@material-ui/core';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import DeleteIcon from '@material-ui/icons/Delete';
import { InfoCard } from '@backstage/core-components';
import { FormField, FormFieldType } from '../types';

const FIELD_TYPES: { label: string; value: FormFieldType }[] = [
  { label: 'String', value: 'string' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'Entity Picker', value: 'entity-picker' },
  { label: 'Repository URL Picker', value: 'repo-url-picker' },
];

function emptyField(): FormField {
  return {
    name: '',
    title: '',
    description: '',
    type: 'string',
    required: false,
  };
}

/**
 * A form field editor used to build the `parameters` section of a
 * scaffolder template. Fields can be added, reordered, and removed.
 *
 * @public
 */
export function FormBuilder(props: {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}): JSX.Element {
  const { fields, onChange } = props;

  function updateField(index: number, patch: Partial<FormField>): void {
    onChange(
      fields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    );
  }

  function removeField(index: number): void {
    onChange(fields.filter((_, i) => i !== index));
  }

  function moveField(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= fields.length) {
      return;
    }
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <InfoCard title="Form Fields">
      <Grid container spacing={2}>
        {fields.map((field, index) => (
          <Grid item xs={12} key={index}>
            <Paper variant="outlined" style={{ padding: 16 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Name"
                    fullWidth
                    required
                    value={field.name}
                    onChange={e => updateField(index, { name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Title"
                    fullWidth
                    required
                    value={field.title}
                    onChange={e =>
                      updateField(index, { title: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Description"
                    fullWidth
                    value={field.description}
                    onChange={e =>
                      updateField(index, { description: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    select
                    label="Type"
                    fullWidth
                    value={field.type}
                    onChange={e =>
                      updateField(index, {
                        type: e.target.value as FormFieldType,
                      })
                    }
                  >
                    {FIELD_TYPES.map(option => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={6} sm={1}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.required}
                        onChange={e =>
                          updateField(index, { required: e.target.checked })
                        }
                      />
                    }
                    label="Required"
                  />
                </Grid>
                <Grid item xs={6} sm={2}>
                  <IconButton
                    aria-label="Move field up"
                    disabled={index === 0}
                    onClick={() => moveField(index, -1)}
                  >
                    <ArrowUpwardIcon />
                  </IconButton>
                  <IconButton
                    aria-label="Move field down"
                    disabled={index === fields.length - 1}
                    onClick={() => moveField(index, 1)}
                  >
                    <ArrowDownwardIcon />
                  </IconButton>
                  <IconButton
                    aria-label="Remove field"
                    onClick={() => removeField(index)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        ))}
        {fields.length === 0 && (
          <Grid item xs={12}>
            <Typography variant="body2" color="textSecondary">
              No form fields yet. Add one to start building the template's
              parameters.
            </Typography>
          </Grid>
        )}
        <Grid item xs={12}>
          <Button onClick={() => onChange([...fields, emptyField()])}>
            Add field
          </Button>
        </Grid>
      </Grid>
    </InfoCard>
  );
}
