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

import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import {
  CatalogProcessor,
  CatalogProcessorEmit,
  CatalogProcessorCache,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { OverlayStore } from '../database/OverlayStore';

/** @internal */
export class OverlayProcessor implements CatalogProcessor {
  constructor(private readonly store: OverlayStore) {}

  getProcessorName(): string {
    return 'OverlayProcessor';
  }

  async preProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
    _originLocation: LocationSpec,
    _cache: CatalogProcessorCache,
  ): Promise<Entity> {
    const ref = stringifyEntityRef(entity);
    const overlay = await this.store.getOverlay(ref);
    if (!overlay || overlay.patches.length === 0) {
      return entity;
    }

    let result: Entity = {
      ...entity,
      metadata: { ...entity.metadata },
      spec: entity.spec ? { ...entity.spec } : entity.spec,
    };

    for (const patch of overlay.patches) {
      if (patch.path === 'metadata.tags') {
        const currentTags = result.metadata.tags ?? [];
        if (patch.op === 'replace') {
          result = {
            ...result,
            metadata: {
              ...result.metadata,
              tags: Array.isArray(patch.value)
                ? (patch.value as string[])
                : currentTags,
            },
          };
        } else if (patch.op === 'add') {
          const tag = patch.value as string;
          result = {
            ...result,
            metadata: {
              ...result.metadata,
              tags: currentTags.includes(tag)
                ? currentTags
                : [...currentTags, tag],
            },
          };
        } else if (patch.op === 'remove') {
          const tag = patch.value as string | undefined;
          result = {
            ...result,
            metadata: {
              ...result.metadata,
              tags: tag === undefined ? [] : currentTags.filter(t => t !== tag),
            },
          };
        }
      } else if (patch.path === 'spec.lifecycle') {
        if (patch.op === 'add' || patch.op === 'replace') {
          result = {
            ...result,
            spec: { ...result.spec, lifecycle: patch.value as string },
          };
        } else if (patch.op === 'remove') {
          const { lifecycle: _, ...restSpec } = result.spec ?? {};
          result = { ...result, spec: restSpec };
        }
      } else if (patch.op === 'add' || patch.op === 'replace') {
        if (patch.path.startsWith('metadata.annotations.')) {
          const key = patch.path.slice('metadata.annotations.'.length);
          result = {
            ...result,
            metadata: {
              ...result.metadata,
              annotations: {
                ...result.metadata.annotations,
                [key]: patch.value as string,
              },
            },
          };
        } else if (patch.path.startsWith('metadata.labels.')) {
          const key = patch.path.slice('metadata.labels.'.length);
          result = {
            ...result,
            metadata: {
              ...result.metadata,
              labels: {
                ...result.metadata.labels,
                [key]: patch.value as string,
              },
            },
          };
        }
      } else if (patch.op === 'remove') {
        if (patch.path.startsWith('metadata.annotations.')) {
          const key = patch.path.slice('metadata.annotations.'.length);
          const { [key]: _, ...rest } = result.metadata.annotations ?? {};
          result = {
            ...result,
            metadata: {
              ...result.metadata,
              annotations: rest,
            },
          };
        } else if (patch.path.startsWith('metadata.labels.')) {
          const key = patch.path.slice('metadata.labels.'.length);
          const { [key]: _, ...rest } = result.metadata.labels ?? {};
          result = {
            ...result,
            metadata: {
              ...result.metadata,
              labels: rest,
            },
          };
        }
      }
    }

    return result;
  }
}
