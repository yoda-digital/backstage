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

import { useMemo, useState } from 'react';
import {
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select as MuiSelect,
  TextField,
  Typography,
} from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import { RepositoryInfo } from '../../types';

/**
 * Props for {@link RepoStep}.
 *
 * @public
 */
export interface RepoStepProps {
  repositories: RepositoryInfo[];
  loading: boolean;
  selectedIds: string[];
  onChangeSelected: (ids: string[]) => void;
}

const ALL_LANGUAGES = '__all__';

/**
 * Step 4 of the {@link IngestionWizard}: choose which repositories within
 * the selected organization/group to ingest.
 *
 * @public
 */
export function RepoStep(props: RepoStepProps): JSX.Element {
  const { repositories, loading, selectedIds, onChangeSelected } = props;
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState(ALL_LANGUAGES);

  const languages = useMemo(
    () =>
      Array.from(
        new Set(
          repositories
            .map(repository => repository.language)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [repositories],
  );

  const filtered = useMemo(
    () =>
      repositories.filter(repository => {
        const matchesSearch = repository.name
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesLanguage =
          language === ALL_LANGUAGES || repository.language === language;
        return matchesSearch && matchesLanguage;
      }),
    [repositories, search, language],
  );

  if (loading) {
    return <Progress />;
  }

  const filteredIds = filtered.map(repository => repository.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));

  function toggle(id: string): void {
    onChangeSelected(
      selectedIds.includes(id)
        ? selectedIds.filter(selectedId => selectedId !== id)
        : [...selectedIds, id],
    );
  }

  function toggleAll(): void {
    if (allFilteredSelected) {
      onChangeSelected(selectedIds.filter(id => !filteredIds.includes(id)));
    } else {
      onChangeSelected(Array.from(new Set([...selectedIds, ...filteredIds])));
    }
  }

  return (
    <>
      <Grid
        container
        spacing={2}
        alignItems="center"
        style={{ marginBottom: 8 }}
      >
        <Grid item xs={12} sm={6}>
          <TextField
            label="Filter by name"
            fullWidth
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth>
            <InputLabel id="language-filter-label">Language</InputLabel>
            <MuiSelect
              labelId="language-filter-label"
              value={language}
              onChange={e => setLanguage(e.target.value as string)}
            >
              <MenuItem value={ALL_LANGUAGES}>All languages</MenuItem>
              {languages.map(lang => (
                <MenuItem value={lang} key={lang}>
                  {lang}
                </MenuItem>
              ))}
            </MuiSelect>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={2}>
          <FormControlLabel
            control={
              <Checkbox
                checked={allFilteredSelected}
                indeterminate={
                  !allFilteredSelected &&
                  filteredIds.some(id => selectedIds.includes(id))
                }
                onChange={toggleAll}
              />
            }
            label="Select all"
          />
        </Grid>
      </Grid>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        {selectedIds.length} of {repositories.length} repositories selected
        &middot; estimated {selectedIds.length} entities
      </Typography>
      <List dense>
        {filtered.map(repository => (
          <ListItem
            key={repository.id}
            button
            onClick={() => toggle(repository.id)}
          >
            <ListItemIcon>
              <Checkbox
                edge="start"
                checked={selectedIds.includes(repository.id)}
                tabIndex={-1}
                disableRipple
              />
            </ListItemIcon>
            <ListItemText
              primary={repository.name}
              secondary={repository.description}
            />
            {repository.language && (
              <Chip
                size="small"
                label={repository.language}
                style={{ marginRight: 8 }}
              />
            )}
            <Chip
              size="small"
              label={
                repository.hasCatalogInfo
                  ? 'catalog-info.yaml found'
                  : 'no catalog-info.yaml'
              }
              color={repository.hasCatalogInfo ? 'primary' : 'default'}
            />
          </ListItem>
        ))}
      </List>
    </>
  );
}
