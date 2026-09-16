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
  Chip,
  Grid,
  Typography,
} from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import { ProviderInfo } from '../../types';

/**
 * Props for {@link ProviderStep}.
 *
 * @public
 */
export interface ProviderStepProps {
  providers: ProviderInfo[];
  loading: boolean;
  selectedProviderId?: string;
  onSelect: (provider: ProviderInfo) => void;
}

/**
 * Step 1 of the {@link IngestionWizard}: choose the SCM provider to ingest
 * repositories from.
 *
 * @public
 */
export function ProviderStep(props: ProviderStepProps): JSX.Element {
  const { providers, loading, selectedProviderId, onSelect } = props;

  if (loading) {
    return <Progress />;
  }

  if (providers.length === 0) {
    return (
      <Typography color="textSecondary">
        No SCM providers are configured. Add a `catalogBuilder.providers` entry
        with matching `integrations.gitlab` or `integrations.azure` credentials.
      </Typography>
    );
  }

  return (
    <Grid container spacing={2}>
      {providers.map(provider => (
        <Grid item xs={12} sm={6} md={4} key={provider.id}>
          <Card
            variant="outlined"
            style={{
              borderColor:
                selectedProviderId === provider.id ? '#1976d2' : undefined,
              borderWidth: selectedProviderId === provider.id ? 2 : 1,
            }}
          >
            <CardActionArea onClick={() => onSelect(provider)}>
              <CardContent>
                <Typography variant="h6">{provider.name}</Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {provider.host}
                </Typography>
                <Chip
                  size="small"
                  label={
                    provider.authenticated
                      ? 'Authenticated'
                      : 'Not authenticated'
                  }
                  color={provider.authenticated ? 'primary' : 'default'}
                />
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
