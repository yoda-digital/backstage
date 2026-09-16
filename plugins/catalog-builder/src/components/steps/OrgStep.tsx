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
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Radio,
  TextField,
  Typography,
} from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import { OrganizationInfo } from '../../types';

/**
 * Props for {@link OrgStep}.
 *
 * @public
 */
export interface OrgStepProps {
  organizations: OrganizationInfo[];
  loading: boolean;
  selectedOrganizationId?: string;
  onSelect: (organization: OrganizationInfo) => void;
}

/**
 * Step 3 of the {@link IngestionWizard}: choose the organization or group to
 * ingest repositories from.
 *
 * @public
 */
export function OrgStep(props: OrgStepProps): JSX.Element {
  const { organizations, loading, selectedOrganizationId, onSelect } = props;
  const [search, setSearch] = useState('');

  if (loading) {
    return <Progress />;
  }

  const filtered = organizations.filter(organization =>
    organization.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <TextField
        label="Search organizations"
        fullWidth
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 16 }}
      />
      {filtered.length === 0 ? (
        <Typography color="textSecondary">No organizations found.</Typography>
      ) : (
        <List dense>
          {filtered.map(organization => (
            <ListItem
              key={organization.id}
              button
              selected={organization.id === selectedOrganizationId}
              onClick={() => onSelect(organization)}
            >
              <Radio
                checked={organization.id === selectedOrganizationId}
                tabIndex={-1}
                disableRipple
              />
              <ListItemText
                primary={organization.name}
                secondary={organization.description}
              />
              {organization.repoCount !== undefined && (
                <ListItemSecondaryAction>
                  <Typography variant="body2" color="textSecondary">
                    {organization.repoCount} repos
                  </Typography>
                </ListItemSecondaryAction>
              )}
            </ListItem>
          ))}
        </List>
      )}
    </>
  );
}
