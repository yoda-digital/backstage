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

import { Entity } from '@backstage/catalog-model';
import { InputError } from '@backstage/errors';
import {
  CatalogProcessor,
  CatalogProcessorEmit,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';

/**
 * A catalog processor that validates {@link DatasetEntityV1alpha1} entities,
 * ensuring their required spec fields are present.
 *
 * @internal
 */
export class DatasetProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'DatasetProcessor';
  }

  async validateEntityKind(entity: Entity): Promise<boolean> {
    return entity.kind === 'Dataset';
  }

  async preProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== 'Dataset') {
      return entity;
    }

    const spec = entity.spec as Record<string, unknown> | undefined;
    if (!spec?.type || !spec?.warehouse || !spec?.owner) {
      throw new InputError(
        `Dataset entity ${entity.metadata.name} must have spec.type, spec.warehouse, and spec.owner`,
      );
    }
    return entity;
  }
}
