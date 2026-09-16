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

import useAsync from 'react-use/esm/useAsync';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import { useApi } from '@backstage/core-plugin-api';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { catalogApiRef, useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { DatasetEntityV1alpha1 } from '@backstage/plugin-data-experience-common';
import { LineageGraph } from './LineageGraph';

/**
 * Entity content tab that renders the dataset lineage graph, centered on
 * the current entity, built from `dependsOn` relations between Dataset
 * entities in the catalog.
 *
 * @public
 */
export function EntityDatasetLineageContent(): JSX.Element {
  const { entity } = useEntity();
  const catalogApi = useApi(catalogApiRef);
  const focusRef = stringifyEntityRef(entity);

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

  if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  if (loading) {
    return <Progress />;
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Lineage
        </Typography>
        <LineageGraph datasets={datasets ?? []} focusRef={focusRef} />
      </CardContent>
    </Card>
  );
}
