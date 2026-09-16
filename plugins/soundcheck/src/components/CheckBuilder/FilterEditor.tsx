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

import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { SoundcheckEntityFilter } from '@backstage/plugin-soundcheck-common';
import Box from '@material-ui/core/Box';
import Checkbox from '@material-ui/core/Checkbox';
import Chip from '@material-ui/core/Chip';
import Grid from '@material-ui/core/Grid';
import InputLabel from '@material-ui/core/InputLabel';
import ListItemText from '@material-ui/core/ListItemText';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import Typography from '@material-ui/core/Typography';
import useAsync from 'react-use/lib/useAsync';

const FACETS = [
  'kind',
  'spec.type',
  'spec.lifecycle',
  'metadata.tags',
] as const;

type FilterField = keyof SoundcheckEntityFilter;

const FIELDS: {
  field: FilterField;
  facet: (typeof FACETS)[number];
  label: string;
}[] = [
  { field: 'kinds', facet: 'kind', label: 'Kind' },
  { field: 'types', facet: 'spec.type', label: 'Type' },
  { field: 'lifecycles', facet: 'spec.lifecycle', label: 'Lifecycle' },
  { field: 'tags', facet: 'metadata.tags', label: 'Tags' },
];

function MultiSelectFilter(props: {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const { label, options, values, onChange } = props;
  const id = `soundcheck-filter-${label.toLowerCase()}`;
  return (
    <Box>
      <InputLabel id={id} shrink>
        {label}
      </InputLabel>
      <Select
        labelId={id}
        multiple
        fullWidth
        displayEmpty
        value={values}
        onChange={event => onChange(event.target.value as string[])}
        renderValue={selected => (
          <Box display="flex" flexWrap="wrap" gridGap={4}>
            {(selected as string[]).length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                Any
              </Typography>
            ) : (
              (selected as string[]).map(value => (
                <Chip key={value} label={value} size="small" />
              ))
            )}
          </Box>
        )}
      >
        {options.length === 0 && (
          <MenuItem disabled value="">
            No known values
          </MenuItem>
        )}
        {options.map(option => (
          <MenuItem key={option} value={option}>
            <Checkbox checked={values.includes(option)} size="small" />
            <ListItemText primary={option} />
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}

/**
 * Props for {@link FilterEditor}.
 *
 * @public
 */
export interface FilterEditorProps {
  filter: SoundcheckEntityFilter;
  excludeFilter: SoundcheckEntityFilter;
  onChangeFilter: (filter: SoundcheckEntityFilter) => void;
  onChangeExcludeFilter: (filter: SoundcheckEntityFilter) => void;
}

/**
 * Editor for the entity filter a check applies to — which kinds, types,
 * lifecycles, and tags of catalog entity it targets — plus a mirrored
 * "exclude" section for entities that should never be targeted. Filter
 * options are populated from the catalog's live facets.
 *
 * @public
 */
export function FilterEditor(props: FilterEditorProps) {
  const { filter, excludeFilter, onChangeFilter, onChangeExcludeFilter } =
    props;
  const catalogApi = useApi(catalogApiRef);
  const { value: facets } = useAsync(
    async () => catalogApi.getEntityFacets({ facets: [...FACETS] }),
    [catalogApi],
  );

  function optionsFor(facet: (typeof FACETS)[number]): string[] {
    return facets?.facets[facet]?.map(entry => entry.value) ?? [];
  }

  return (
    <Box display="flex" flexDirection="column" gridGap={24}>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Include entities matching
        </Typography>
        <Grid container spacing={2}>
          {FIELDS.map(({ field, facet, label }) => (
            <Grid item xs={12} sm={6} key={field}>
              <MultiSelectFilter
                label={label}
                options={optionsFor(facet)}
                values={filter[field] ?? []}
                onChange={values =>
                  onChangeFilter({ ...filter, [field]: values })
                }
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Exclude entities matching
        </Typography>
        <Typography
          variant="caption"
          color="textSecondary"
          component="p"
          gutterBottom
        >
          Reserved for entities that should never be targeted by this check. The
          Soundcheck evaluation engine does not enforce exclude filters yet —
          they are stored with the check definition for forward compatibility.
        </Typography>
        <Grid container spacing={2}>
          {FIELDS.map(({ field, facet, label }) => (
            <Grid item xs={12} sm={6} key={field}>
              <MultiSelectFilter
                label={label}
                options={optionsFor(facet)}
                values={excludeFilter[field] ?? []}
                onChange={values =>
                  onChangeExcludeFilter({ ...excludeFilter, [field]: values })
                }
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}
