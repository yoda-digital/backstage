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

import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import useAsync from 'react-use/esm/useAsync';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Grid from '@material-ui/core/Grid';
import Switch from '@material-ui/core/Switch';
import Typography from '@material-ui/core/Typography';
import { useApi } from '@backstage/core-plugin-api';
import {
  CodeSnippet,
  Content,
  Header,
  Page,
  Progress,
  ResponseErrorPanel,
  StructuredMetadataTable,
} from '@backstage/core-components';
import { growthBookApiRef } from '../api/ref';

/**
 * A page showing the configuration, targeting rules, and per-environment
 * variation values for a single GrowthBook feature flag.
 *
 * @public
 */
export function FeatureDetail(): JSX.Element {
  const { id = '' } = useParams();
  const growthBookApi = useApi(growthBookApiRef);
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    value: feature,
    loading,
    error,
  } = useAsync(
    async () => growthBookApi.getFeature(id),
    [growthBookApi, id, refreshKey],
  );

  const handleToggleEnvironment = useCallback(
    async (envName: string) => {
      if (!feature) {
        return;
      }
      const env = feature.environments[envName];
      await growthBookApi.updateFeature(feature.id, {
        environments: {
          ...feature.environments,
          [envName]: { ...env, enabled: !env.enabled },
        },
      });
      setRefreshKey(key => key + 1);
    },
    [growthBookApi, feature],
  );

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Feature" />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  if (loading || !feature) {
    return (
      <Page themeId="tool">
        <Header title="Feature" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title={feature.id} subtitle={feature.description} />
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">Configuration</Typography>
                <StructuredMetadataTable
                  metadata={{
                    id: feature.id,
                    description: feature.description,
                    valueType: feature.valueType,
                    tags: feature.tags.join(', ') || '—',
                  }}
                />
                <Typography variant="subtitle2" style={{ marginTop: 16 }}>
                  Default value
                </Typography>
                <CodeSnippet
                  language="json"
                  text={JSON.stringify(feature.defaultValue, null, 2)}
                  showCopyCodeButton
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">Environments</Typography>
                {Object.entries(feature.environments).map(([envName, env]) => (
                  <div key={envName} style={{ marginBottom: 16 }}>
                    <Grid
                      container
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Grid item>
                        <Typography variant="subtitle1">{envName}</Typography>
                      </Grid>
                      <Grid item>
                        <Switch
                          checked={env.enabled}
                          size="small"
                          onChange={() => handleToggleEnvironment(envName)}
                        />
                      </Grid>
                    </Grid>
                    <Typography variant="body2" color="textSecondary">
                      {env.rules.length} targeting rule
                      {env.rules.length === 1 ? '' : 's'}
                    </Typography>
                    {env.rules.length > 0 && (
                      <CodeSnippet
                        language="json"
                        text={JSON.stringify(env.rules, null, 2)}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
