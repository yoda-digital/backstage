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
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Chip from '@material-ui/core/Chip';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { useApi } from '@backstage/core-plugin-api';
import {
  Content,
  Header,
  Page,
  Progress,
  ResponseErrorPanel,
  StatusError,
  StatusOK,
  StatusWarning,
  Table,
  TableColumn,
} from '@backstage/core-components';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  RELATION_DEPENDENCY_OF,
  RELATION_DEPENDS_ON,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import {
  ColumnMetadata,
  DatasetEntityV1alpha1,
} from '@backstage/plugin-data-experience-common';
import { dataExperienceApiRef } from '../api/ref';

function FreshnessIndicator(props: { freshness?: string }): JSX.Element {
  if (!props.freshness) {
    return <StatusWarning>Unknown</StatusWarning>;
  }
  return <StatusOK>{props.freshness}</StatusOK>;
}

/**
 * A page showing the details of a single Dataset entity: metadata, columns,
 * freshness, quality metrics, lineage, and owner information.
 *
 * @public
 */
export function DatasetDetail(): JSX.Element {
  const { namespace = 'default', name = '' } = useParams();
  const catalogApi = useApi(catalogApiRef);
  const dataExperienceApi = useApi(dataExperienceApiRef);
  const [refreshing, setRefreshing] = useState(false);

  const { value, loading, error } = useAsync(async () => {
    const entity = (await catalogApi.getEntityByRef({
      kind: 'Dataset',
      namespace,
      name,
    })) as DatasetEntityV1alpha1 | undefined;
    if (!entity) {
      return undefined;
    }
    const entityRef = stringifyEntityRef(entity);
    const metadata = await dataExperienceApi
      .getMetadata(entityRef)
      .catch(() => undefined);
    return { entity, entityRef, metadata };
  }, [catalogApi, dataExperienceApi, namespace, name]);

  const handleRefresh = useCallback(async () => {
    if (!value) {
      return;
    }
    setRefreshing(true);
    try {
      await dataExperienceApi.refreshMetadata(value.entityRef);
    } finally {
      setRefreshing(false);
    }
  }, [dataExperienceApi, value]);

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Dataset" />
        <Content>
          <ResponseErrorPanel error={error} />
        </Content>
      </Page>
    );
  }

  if (loading || !value) {
    return (
      <Page themeId="tool">
        <Header title="Dataset" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  const { entity, metadata } = value;
  const upstream = (entity.relations ?? [])
    .filter(r => r.type === RELATION_DEPENDS_ON)
    .map(r => r.targetRef);
  const downstream = (entity.relations ?? [])
    .filter(r => r.type === RELATION_DEPENDENCY_OF)
    .map(r => r.targetRef);

  const columns: TableColumn<ColumnMetadata>[] = [
    { title: 'Name', field: 'name' },
    { title: 'Type', field: 'type' },
    {
      title: 'Nullable',
      render: column => (column.nullable ? 'Yes' : 'No'),
    },
    { title: 'Description', field: 'description' },
  ];

  return (
    <Page themeId="tool">
      <Header
        title={entity.metadata.title ?? entity.metadata.name}
        subtitle={`${entity.spec.type} in ${entity.spec.warehouse}`}
      />
      <Content>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6">Columns</Typography>
                <Table
                  columns={columns}
                  data={metadata?.columns ?? []}
                  options={{ paging: false, search: false, toolbar: false }}
                  emptyContent={
                    <Typography style={{ padding: 16 }}>
                      No column metadata available.
                    </Typography>
                  }
                />
              </CardContent>
            </Card>

            <Card style={{ marginTop: 16 }}>
              <CardContent>
                <Typography variant="h6">Lineage</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Upstream</Typography>
                    {upstream.length === 0 ? (
                      <Typography color="textSecondary">None</Typography>
                    ) : (
                      upstream.map(ref => <Chip key={ref} label={ref} />)
                    )}
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2">Downstream</Typography>
                    {downstream.length === 0 ? (
                      <Typography color="textSecondary">None</Typography>
                    ) : (
                      downstream.map(ref => <Chip key={ref} label={ref} />)
                    )}
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6">Quality</Typography>
                <Typography variant="body2" color="textSecondary">
                  Freshness
                </Typography>
                <FreshnessIndicator
                  freshness={entity.spec.quality?.freshness}
                />
                <Typography
                  variant="body2"
                  color="textSecondary"
                  style={{ marginTop: 8 }}
                >
                  Completeness
                </Typography>
                {entity.spec.quality?.completeness !== undefined ? (
                  <StatusOK>{entity.spec.quality.completeness}%</StatusOK>
                ) : (
                  <StatusError>Unknown</StatusError>
                )}
                <Button
                  size="small"
                  color="primary"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  style={{ marginTop: 16 }}
                >
                  {refreshing ? 'Refreshing…' : 'Refresh metadata'}
                </Button>
              </CardContent>
            </Card>

            <Card style={{ marginTop: 16 }}>
              <CardContent>
                <Typography variant="h6">Owner</Typography>
                <Typography variant="body2">{entity.spec.owner}</Typography>
                {entity.spec.tags && entity.spec.tags.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {entity.spec.tags.map(tag => (
                      <Chip key={tag} label={tag} size="small" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
