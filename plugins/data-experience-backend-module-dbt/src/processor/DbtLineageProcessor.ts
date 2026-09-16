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
  Entity,
  getCompoundEntityRef,
  RELATION_DEPENDENCY_OF,
  RELATION_DEPENDS_ON,
} from '@backstage/catalog-model';
import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { DbtManifest } from '../manifest/DbtManifest';

/**
 * A catalog processor that links `Dataset` entities produced from dbt
 * models and sources to the datasets they depend on, based on the dbt
 * manifest's `depends_on` graph. Relations are emitted using the entity's
 * `spec.table` (falling back to its name) matched against dbt node names,
 * so this expects Dataset entity names to line up with the underlying
 * warehouse table/model names.
 *
 * @public
 */
export class DbtLineageProcessor implements CatalogProcessor {
  constructor(private readonly manifest: DbtManifest) {}

  getProcessorName(): string {
    return 'DbtLineageProcessor';
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== 'Dataset') {
      return entity;
    }

    const spec = entity.spec as { table?: string } | undefined;
    const datasetName = spec?.table ?? entity.metadata.name;
    const dependencies = this.manifest.getDependencies(datasetName);
    if (dependencies.length === 0) {
      return entity;
    }

    const selfRef = getCompoundEntityRef(entity);
    for (const dependency of dependencies) {
      const targetRef = {
        kind: 'Dataset',
        namespace: selfRef.namespace,
        name: dependency.name,
      };
      emit(
        processingResult.relation({
          source: selfRef,
          type: RELATION_DEPENDS_ON,
          target: targetRef,
        }),
      );
      emit(
        processingResult.relation({
          source: targetRef,
          type: RELATION_DEPENDENCY_OF,
          target: selfRef,
        }),
      );
    }

    return entity;
  }
}
