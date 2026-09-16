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
  AuthService,
  LoggerService,
  SchedulerService,
} from '@backstage/backend-plugin-api';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';
import { SoundcheckStore } from '../database/SoundcheckStore';
import { DateTime } from 'luxon';

/**
 * Runs registered fact collectors on a schedule, storing the results for
 * every catalog entity in the {@link SoundcheckStore}.
 *
 * @internal
 */
export class FactScheduler {
  constructor(
    private readonly options: {
      collectors: SoundcheckFactCollector[];
      store: SoundcheckStore;
      scheduler: SchedulerService;
      catalog: CatalogService;
      auth: AuthService;
      logger: LoggerService;
      frequency: { minutes: number };
      timeout: { minutes: number };
    },
  ) {}

  async start(): Promise<void> {
    for (const collector of this.options.collectors) {
      await this.options.scheduler.scheduleTask({
        id: `soundcheck-collect-${collector.factRef}`,
        frequency: this.options.frequency,
        timeout: this.options.timeout,
        fn: async () => {
          await this.collectFacts(collector);
        },
      });
      this.options.logger.info(
        `Scheduled fact collection for ${collector.factRef}`,
      );
    }
  }

  private async collectFacts(
    collector: SoundcheckFactCollector,
  ): Promise<void> {
    const credentials = await this.options.auth.getOwnServiceCredentials();
    const entities = await this.options.catalog.getEntities(
      {
        filter: { kind: ['Component', 'API', 'Resource'] },
        fields: ['metadata.name', 'metadata.namespace', 'kind'],
      },
      { credentials },
    );

    for (const entity of entities.items) {
      const entityRef = `${entity.kind}:${
        entity.metadata.namespace ?? 'default'
      }/${entity.metadata.name}`;
      try {
        const factData = await collector.collect(entityRef);
        await this.options.store.upsertFact({
          factRef: collector.factRef,
          entityRef,
          data: factData.data,
          collectedAt: DateTime.now().toISO() as string,
          expiresAt: factData.expiresAt,
        });
      } catch (error) {
        this.options.logger.warn(
          `Failed to collect ${collector.factRef} for ${entityRef}`,
          error as Error,
        );
      }
    }
  }
}
