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
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Typography,
} from '@material-ui/core';
import { CatalogBuilderMode } from '../../types';

interface ModeOption {
  mode: CatalogBuilderMode;
  title: string;
  description: string;
  recommendation: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    mode: 'portal-managed',
    title: 'Portal-Managed',
    description:
      'The portal creates catalog entities directly from repository metadata. No catalog-info.yaml file is needed in the repository, and future metadata edits are stored as entity overlays.',
    recommendation: 'Recommended for large-scale, low-friction onboarding.',
  },
  {
    mode: 'yaml-managed',
    title: 'YAML-Managed',
    description:
      'The portal registers a Location pointing at each repository’s existing catalog-info.yaml file. Repositories without one are skipped until a catalog-info.yaml is added.',
    recommendation:
      'Recommended when teams already own their catalog-info.yaml.',
  },
];

/**
 * Props for {@link ModeStep}.
 *
 * @public
 */
export interface ModeStepProps {
  mode?: CatalogBuilderMode;
  onSelect: (mode: CatalogBuilderMode) => void;
}

/**
 * Step 2 of the {@link IngestionWizard}: choose how ingested repositories
 * are managed going forward.
 *
 * @public
 */
export function ModeStep(props: ModeStepProps): JSX.Element {
  const { mode, onSelect } = props;

  return (
    <Grid container spacing={2}>
      {MODE_OPTIONS.map(option => (
        <Grid item xs={12} sm={6} key={option.mode}>
          <Card
            variant="outlined"
            style={{
              borderColor: mode === option.mode ? '#1976d2' : undefined,
              borderWidth: mode === option.mode ? 2 : 1,
              height: '100%',
            }}
          >
            <CardActionArea
              onClick={() => onSelect(option.mode)}
              style={{ height: '100%', padding: 8 }}
            >
              <CardContent>
                <Typography variant="h6">{option.title}</Typography>
                <Typography variant="body2" paragraph>
                  {option.description}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {option.recommendation}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
