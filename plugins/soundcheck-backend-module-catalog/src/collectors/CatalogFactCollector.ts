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

import { AuthService, LoggerService } from '@backstage/backend-plugin-api';
import { CatalogApi } from '@backstage/catalog-client';
import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';
import { SoundcheckFact } from '@backstage/plugin-soundcheck-common';

/**
 * Options used to create a {@link CatalogFactCollector}.
 * @internal
 */
export interface CatalogFactCollectorOptions {
  catalogClient: CatalogApi;
  auth: AuthService;
  logger: LoggerService;
}

/**
 * Collects catalog metadata quality facts — ownership, system membership,
 * tags, description length, and relation count — for a catalog entity.
 * @internal
 */
export class CatalogFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'soundcheck:catalog/entity-metadata';
  readonly description =
    'Collects catalog metadata facts such as ownership, tags, and description quality';

  private constructor(private readonly options: CatalogFactCollectorOptions) {}

  static create(options: CatalogFactCollectorOptions): CatalogFactCollector {
    return new CatalogFactCollector(options);
  }

  async collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>> {
    const { catalogClient, auth, logger } = this.options;

    try {
      const { token } = await auth.getPluginRequestToken({
        onBehalfOf: await auth.getOwnServiceCredentials(),
        targetPluginId: 'catalog',
      });
      const entity = await catalogClient.getEntityByRef(entityRef, {
        token,
      });

      if (!entity) {
        return {
          data: {
            available: false,
            reason: `Entity ${entityRef} was not found in the catalog`,
          },
        };
      }

      const hasOwner = Boolean(entity.spec?.owner);
      const hasSystem = Boolean(entity.spec?.system);
      const tags = entity.metadata.tags ?? [];
      const description = entity.metadata.description ?? '';
      const relationsCount = entity.relations?.length ?? 0;

      return {
        data: {
          available: true,
          hasOwner,
          hasSystem,
          hasTags: tags.length > 0,
          tagsCount: tags.length,
          descriptionLength: description.length,
          relationsCount,
        },
      };
    } catch (error) {
      logger.warn(`Failed to collect catalog facts for ${entityRef}: ${error}`);
      return {
        data: {
          available: false,
          reason: 'Failed to reach the catalog API',
        },
      };
    }
  }
}
