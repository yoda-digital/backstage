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

import { useCallback, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import useAsync from 'react-use/esm/useAsync';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Chip from '@material-ui/core/Chip';
import Switch from '@material-ui/core/Switch';
import TextField from '@material-ui/core/TextField';
import Toolbar from '@material-ui/core/Toolbar';
import { useApi } from '@backstage/core-plugin-api';
import {
  Content,
  Header,
  Page,
  Progress,
  ResponseErrorPanel,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { growthBookApiRef, GrowthBookFeature } from '../api/ref';
import { growthbookTranslationRef } from '../translation';

function isEnabledInAnyEnvironment(feature: GrowthBookFeature): boolean {
  return Object.values(feature.environments).some(env => env.enabled);
}

/**
 * A page listing all GrowthBook feature flags, with search, tag filtering,
 * and a per-environment enable/disable toggle.
 *
 * @public
 */
export function FeaturesPage(): JSX.Element {
  const { t } = useTranslationRef(growthbookTranslationRef);
  const growthBookApi = useApi(growthBookApiRef);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  const {
    value: features,
    loading,
    error,
  } = useAsync(
    async () => growthBookApi.listFeatures(),
    [growthBookApi, refreshKey],
  );

  const allTags = useMemo(
    () => Array.from(new Set((features ?? []).flatMap(f => f.tags))).sort(),
    [features],
  );

  const filteredFeatures = useMemo(() => {
    return (features ?? []).filter(feature => {
      if (
        search &&
        !feature.id.toLowerCase().includes(search.toLowerCase()) &&
        !feature.description.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (
        tagFilter.length > 0 &&
        !tagFilter.every(tag => feature.tags.includes(tag))
      ) {
        return false;
      }
      return true;
    });
  }, [features, search, tagFilter]);

  const handleToggle = useCallback(
    async (feature: GrowthBookFeature) => {
      const enabled = !isEnabledInAnyEnvironment(feature);
      const environments = Object.fromEntries(
        Object.entries(feature.environments).map(([env, config]) => [
          env,
          { ...config, enabled },
        ]),
      );
      await growthBookApi.updateFeature(feature.id, { environments });
      setRefreshKey(key => key + 1);
    },
    [growthBookApi],
  );

  const columns: TableColumn<GrowthBookFeature>[] = [
    {
      title: 'Id',
      render: feature => (
        <RouterLink to={`/growthbook/features/${feature.id}`}>
          {feature.id}
        </RouterLink>
      ),
    },
    { title: 'Description', field: 'description' },
    { title: 'Type', field: 'valueType' },
    {
      title: 'Tags',
      render: feature => (
        <>
          {feature.tags.map(tag => (
            <Chip key={tag} label={tag} size="small" />
          ))}
        </>
      ),
    },
    {
      title: 'Enabled',
      render: feature => (
        <Switch
          checked={isEnabledInAnyEnvironment(feature)}
          size="small"
          onChange={() => handleToggle(feature)}
        />
      ),
    },
  ];

  if (error) {
    return (
      <Page themeId="tool">
        <Header
          title={t('featuresPage.title')}
          subtitle={t('featuresPage.subtitle')}
        />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header
        title={t('featuresPage.title')}
        subtitle={t('featuresPage.subtitle')}
      />
      <Content>
        {loading ? (
          <Progress />
        ) : (
          <>
            <Toolbar disableGutters style={{ gap: 16 }}>
              <TextField
                label={t('featuresPage.searchLabel')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ minWidth: 240 }}
              />
              <Autocomplete
                multiple
                options={allTags}
                value={tagFilter}
                onChange={(_e, value) => setTagFilter(value)}
                style={{ minWidth: 280 }}
                renderInput={params => (
                  <TextField
                    {...params}
                    label={t('featuresPage.tagsLabel')}
                    placeholder={t('featuresPage.tagsPlaceholder')}
                  />
                )}
              />
            </Toolbar>
            <Table
              title={t('featuresPage.tableTitle')}
              columns={columns}
              data={filteredFeatures}
              options={{ paging: true, pageSize: 20 }}
            />
          </>
        )}
      </Content>
    </Page>
  );
}
