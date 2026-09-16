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
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select as MuiSelect,
  TextField,
} from '@material-ui/core';
import { IngestionDetails } from '../../types';

/**
 * Props for {@link DetailsStep}.
 *
 * @public
 */
export interface DetailsStepProps {
  details: IngestionDetails;
  onChange: (details: IngestionDetails) => void;
}

/**
 * Step 5 of the {@link IngestionWizard} (optional): choose default entity
 * settings applied to every ingested repository.
 *
 * @public
 */
export function DetailsStep(props: DetailsStepProps): JSX.Element {
  const { details, onChange } = props;

  return (
    <Grid container spacing={2} style={{ maxWidth: 600 }}>
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel id="details-kind-label">Default entity kind</InputLabel>
          <MuiSelect
            labelId="details-kind-label"
            value={details.kind ?? 'Component'}
            onChange={e =>
              onChange({ ...details, kind: e.target.value as string })
            }
          >
            <MenuItem value="Component">Component</MenuItem>
            <MenuItem value="Resource">Resource</MenuItem>
          </MuiSelect>
        </FormControl>
      </Grid>
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel id="details-lifecycle-label">
            Default lifecycle
          </InputLabel>
          <MuiSelect
            labelId="details-lifecycle-label"
            value={details.lifecycle ?? 'production'}
            onChange={e =>
              onChange({ ...details, lifecycle: e.target.value as string })
            }
          >
            <MenuItem value="production">Production</MenuItem>
            <MenuItem value="experimental">Experimental</MenuItem>
            <MenuItem value="deprecated">Deprecated</MenuItem>
          </MuiSelect>
        </FormControl>
      </Grid>
      <Grid item xs={12}>
        <TextField
          label="Default system"
          fullWidth
          value={details.system ?? ''}
          onChange={e => onChange({ ...details, system: e.target.value })}
          helperText="Optional. Assigns every ingested entity to this system."
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          label="Tags"
          fullWidth
          value={(details.tags ?? []).join(', ')}
          onChange={e =>
            onChange({
              ...details,
              tags: e.target.value
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean),
            })
          }
          helperText="Comma-separated list of tags applied to every ingested entity."
        />
      </Grid>
    </Grid>
  );
}
