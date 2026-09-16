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
import { Link as RouterLink } from 'react-router-dom';
import useAsync from 'react-use/esm/useAsync';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormGroup from '@material-ui/core/FormGroup';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
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
import {
  catalogApiRef,
  CatalogFilterLayout,
} from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { DatasetEntityV1alpha1 } from '@backstage/plugin-data-experience-common';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { dataExperienceApiRef } from '../api/ref';
import { dataExperienceTranslationRef } from '../translation';
import { LineageGraph } from './LineageGraph';

type ViewMode = 'table' | 'lineage';

function entityCatalogPath(entity: DatasetEntityV1alpha1): string {
  const namespace = (entity.metadata.namespace ?? 'default').toLowerCase();
  return `/catalog/${namespace}/${entity.kind.toLowerCase()}/${
    entity.metadata.name
  }`;
}

function AccessRequestDialog(props: {
  dataset: DatasetEntityV1alpha1 | undefined;
  onClose: () => void;
}): JSX.Element {
  const { dataset, onClose } = props;
  const dataExperienceApi = useApi(dataExperienceApiRef);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error>();
  const [submitted, setSubmitted] = useState(false);

  const handleClose = () => {
    setReason('');
    setError(undefined);
    setSubmitted(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!dataset || !reason.trim()) {
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      await dataExperienceApi.requestAccess(
        stringifyEntityRef(dataset),
        reason.trim(),
      );
      setSubmitted(true);
    } catch (e) {
      setError(e as Error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={Boolean(dataset)}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        Request access to {dataset?.metadata.title ?? dataset?.metadata.name}
      </DialogTitle>
      <DialogContent>
        {error && <ResponseErrorPanel error={error} />}
        {submitted ? (
          <Typography>
            Your access request has been sent to the dataset owner.
          </Typography>
        ) : (
          <TextField
            label="Why do you need access?"
            value={reason}
            onChange={e => setReason(e.target.value)}
            fullWidth
            multiline
            minRows={3}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{submitted ? 'Close' : 'Cancel'}</Button>
        {!submitted && (
          <Button
            color="primary"
            variant="contained"
            disabled={submitting || !reason.trim()}
            onClick={handleSubmit}
          >
            {submitting ? 'Sending…' : 'Send request'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

/**
 * A page for browsing and filtering Dataset entities from the catalog.
 *
 * @public
 */
export function DatasetCatalogPage(): JSX.Element {
  const { t } = useTranslationRef(dataExperienceTranslationRef);
  const catalogApi = useApi(catalogApiRef);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<Set<string>>(
    new Set(),
  );
  const [qualityFilter, setQualityFilter] = useState(false);
  const [view, setView] = useState<ViewMode>('table');
  const [accessRequestTarget, setAccessRequestTarget] =
    useState<DatasetEntityV1alpha1>();

  const {
    value: datasets,
    loading,
    error,
  } = useAsync(async () => {
    const response = await catalogApi.getEntities({
      filter: { kind: 'Dataset' },
    });
    return response.items as DatasetEntityV1alpha1[];
  }, [catalogApi]);

  const warehouses = useMemo(
    () =>
      Array.from(
        new Set((datasets ?? []).map(entity => entity.spec.warehouse)),
      ).sort(),
    [datasets],
  );

  const filteredDatasets = useMemo(() => {
    return (datasets ?? []).filter(entity => {
      if (
        search &&
        !entity.metadata.name.toLowerCase().includes(search.toLowerCase()) &&
        !entity.spec.owner.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (
        warehouseFilter.size > 0 &&
        !warehouseFilter.has(entity.spec.warehouse)
      ) {
        return false;
      }
      if (qualityFilter && !entity.spec.quality?.freshness) {
        return false;
      }
      return true;
    });
  }, [datasets, search, warehouseFilter, qualityFilter]);

  const toggleWarehouse = (warehouse: string) => {
    setWarehouseFilter(previous => {
      const next = new Set(previous);
      if (next.has(warehouse)) {
        next.delete(warehouse);
      } else {
        next.add(warehouse);
      }
      return next;
    });
  };

  const columns: TableColumn<DatasetEntityV1alpha1>[] = [
    {
      title: 'Name',
      render: entity => (
        <RouterLink to={entityCatalogPath(entity)}>
          {entity.metadata.title ?? entity.metadata.name}
        </RouterLink>
      ),
    },
    { title: 'Type', field: 'spec.type' },
    { title: 'Warehouse', field: 'spec.warehouse' },
    { title: 'Owner', field: 'spec.owner' },
    {
      title: 'Freshness',
      render: entity => entity.spec.quality?.freshness ?? '—',
    },
    {
      title: 'Completeness',
      render: entity =>
        entity.spec.quality?.completeness !== undefined
          ? `${entity.spec.quality.completeness}%`
          : '—',
    },
    {
      title: 'Actions',
      sorting: false,
      render: entity => (
        <Button size="small" onClick={() => setAccessRequestTarget(entity)}>
          {t('catalogPage.requestAccessButton')}
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <Page themeId="tool">
        <Header
          title={t('catalogPage.title')}
          subtitle={t('catalogPage.subtitle')}
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
        title={t('catalogPage.title')}
        subtitle={t('catalogPage.subtitle')}
      />
      <Content>
        {loading ? (
          <Progress />
        ) : (
          <CatalogFilterLayout>
            <CatalogFilterLayout.Filters>
              <TextField
                label={t('catalogPage.searchLabel')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                fullWidth
                margin="dense"
              />
              <Typography variant="subtitle2" style={{ marginTop: 16 }}>
                {t('catalogPage.warehouseHeading')}
              </Typography>
              <FormGroup>
                {warehouses.map(warehouse => (
                  <FormControlLabel
                    key={warehouse}
                    control={
                      <Checkbox
                        checked={warehouseFilter.has(warehouse)}
                        onChange={() => toggleWarehouse(warehouse)}
                        size="small"
                      />
                    }
                    label={warehouse}
                  />
                ))}
              </FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={qualityFilter}
                    onChange={e => setQualityFilter(e.target.checked)}
                    size="small"
                  />
                }
                label={t('catalogPage.hasQualityDataLabel')}
              />
            </CatalogFilterLayout.Filters>
            <CatalogFilterLayout.Content>
              <div style={{ marginBottom: 16 }}>
                <Button
                  size="small"
                  variant={view === 'table' ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={() => setView('table')}
                  style={{ marginRight: 8 }}
                >
                  {t('catalogPage.tableViewButton')}
                </Button>
                <Button
                  size="small"
                  variant={view === 'lineage' ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={() => setView('lineage')}
                >
                  {t('catalogPage.lineageViewButton')}
                </Button>
              </div>
              {view === 'lineage' ? (
                <LineageGraph datasets={filteredDatasets} />
              ) : (
                <Table
                  title={t('catalogPage.tableTitle')}
                  columns={columns}
                  data={filteredDatasets}
                  options={{ paging: true, pageSize: 20 }}
                  emptyContent={
                    <Typography style={{ padding: 16 }}>
                      No datasets match the current filters.
                    </Typography>
                  }
                />
              )}
            </CatalogFilterLayout.Content>
          </CatalogFilterLayout>
        )}
        <AccessRequestDialog
          dataset={accessRequestTarget}
          onClose={() => setAccessRequestTarget(undefined)}
        />
      </Content>
    </Page>
  );
}
