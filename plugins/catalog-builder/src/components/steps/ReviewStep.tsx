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
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@material-ui/core';
import { WizardState } from '../../types';

/**
 * Props for {@link ReviewStep}.
 *
 * @public
 */
export interface ReviewStepProps {
  state: WizardState;
  starting: boolean;
  onStart: () => void;
}

const SECONDS_PER_REPO = 3;

/**
 * Step 6 of the {@link IngestionWizard}: review the ingestion summary,
 * start the job, and track its progress until it completes.
 *
 * @public
 */
export function ReviewStep(props: ReviewStepProps): JSX.Element {
  const { state, starting, onStart } = props;
  const { provider, mode, organization, selectedRepositoryIds, job } = state;

  const estimatedSeconds = selectedRepositoryIds.length * SECONDS_PER_REPO;

  return (
    <>
      <List dense>
        <ListItem>
          <ListItemText primary="Provider" secondary={provider?.name} />
        </ListItem>
        <ListItem>
          <ListItemText primary="Organization" secondary={organization?.name} />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Mode"
            secondary={
              mode === 'portal-managed' ? 'Portal-Managed' : 'YAML-Managed'
            }
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Repositories to ingest"
            secondary={`${selectedRepositoryIds.length} repositories, ~${selectedRepositoryIds.length} entities`}
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Estimated time"
            secondary={`~${Math.max(estimatedSeconds, 1)}s`}
          />
        </ListItem>
      </List>

      {!job && (
        <Button
          variant="contained"
          color="primary"
          disabled={starting || selectedRepositoryIds.length === 0}
          onClick={onStart}
        >
          Start Ingestion
        </Button>
      )}

      {job && (
        <div style={{ marginTop: 16 }}>
          <Typography variant="body2" gutterBottom>
            {job.processed} / {job.totalRepos} processed &middot;{' '}
            {job.succeeded} succeeded &middot; {job.failed} failed
          </Typography>
          <LinearProgress
            variant="determinate"
            value={
              job.totalRepos > 0 ? (job.processed / job.totalRepos) * 100 : 0
            }
          />
          <Typography
            variant="body2"
            color={job.status === 'failed' ? 'error' : 'textSecondary'}
            style={{ marginTop: 8 }}
          >
            Status: {job.status}
          </Typography>
          {job.errors.length > 0 && (
            <List dense>
              {job.errors.map((error, index) => (
                <ListItem key={`${error.repository}-${index}`}>
                  <ListItemText
                    primary={error.repository}
                    secondary={error.message}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </div>
      )}
    </>
  );
}
