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
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { eventsServiceRef } from '@backstage/plugin-events-node';
import { SoundcheckRuleOperator } from '@backstage/plugin-soundcheck-common';
import {
  SoundcheckCheckProvider,
  SoundcheckCheckProviderExtensionPoint,
  SoundcheckFactCollector,
  SoundcheckFactCollectorExtensionPoint,
  soundcheckCheckProviderExtensionPoint,
  soundcheckFactCollectorExtensionPoint,
} from '@backstage/plugin-soundcheck-node';
import { SoundcheckStore } from './database/SoundcheckStore';
import { CheckEngine } from './engine/CheckEngine';
import { FactScheduler } from './engine/FactScheduler';
import { scheduleHistoryCleanup } from './engine/HistoryCleanupTask';
import { createRouter } from './service/router';

class FactCollectorExtensionPointImpl
  implements SoundcheckFactCollectorExtensionPoint
{
  readonly collectors = new Array<SoundcheckFactCollector>();

  addCollector(collector: SoundcheckFactCollector): void {
    this.collectors.push(collector);
  }
}

class CheckProviderExtensionPointImpl
  implements SoundcheckCheckProviderExtensionPoint
{
  readonly providers = new Array<SoundcheckCheckProvider>();

  addProvider(provider: SoundcheckCheckProvider): void {
    this.providers.push(provider);
  }
}

/**
 * The Soundcheck backend plugin — a quality and compliance engine that
 * evaluates catalog entities against checks grouped into certification
 * tracks.
 *
 * @public
 */
export const soundcheckPlugin = createBackendPlugin({
  pluginId: 'soundcheck',
  register(env) {
    const factCollectors = new FactCollectorExtensionPointImpl();
    const checkProviders = new CheckProviderExtensionPointImpl();

    env.registerExtensionPoint(
      soundcheckFactCollectorExtensionPoint,
      factCollectors,
    );
    env.registerExtensionPoint(
      soundcheckCheckProviderExtensionPoint,
      checkProviders,
    );

    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        scheduler: coreServices.scheduler,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        auth: coreServices.auth,
        permissions: coreServices.permissions,
        events: eventsServiceRef,
        catalog: catalogServiceRef,
      },
      async init({
        config,
        logger,
        database,
        scheduler,
        httpRouter,
        httpAuth,
        auth,
        permissions,
        events,
        catalog,
      }) {
        const knex = await database.getClient();
        const store = await SoundcheckStore.create({ database: knex });
        const engine = new CheckEngine();

        // Load checks from registered providers
        for (const provider of checkProviders.providers) {
          const providerChecks = await provider.getChecks();
          for (const check of providerChecks) {
            await store.upsertCheck({
              id: check.id,
              name: check.name,
              description: check.description,
              factRef: check.factRef,
              rule: {
                operator: check.rule.operator as SoundcheckRuleOperator,
                field: check.rule.field,
                value: check.rule.value,
              },
            });
          }
          logger.info(
            `Loaded ${providerChecks.length} checks from provider ${provider.providerId}`,
          );
        }

        // Start fact collection scheduler
        const scheduleConfig = config.getOptionalConfig('soundcheck.schedule');
        const factScheduler = new FactScheduler({
          collectors: factCollectors.collectors,
          store,
          scheduler,
          catalog,
          auth,
          logger,
          frequency: {
            minutes:
              scheduleConfig?.getOptionalNumber('frequency.minutes') ?? 30,
          },
          timeout: {
            minutes: scheduleConfig?.getOptionalNumber('timeout.minutes') ?? 5,
          },
        });
        await factScheduler.start();

        const historyConfig = config.getOptionalConfig(
          'soundcheck.results.history',
        );
        if (historyConfig?.getOptionalBoolean('enable') ?? true) {
          await scheduleHistoryCleanup({
            store,
            scheduler,
            logger,
            retentionTimeInDays:
              historyConfig?.getOptionalNumber('retentionTimeInDays') ?? 120,
            cleanupFrequencyCron:
              historyConfig?.getOptionalString('cleanupFrequencyCron') ??
              '0 0 0 * * *',
          });
        }

        const router = createRouter({
          store,
          engine,
          httpAuth,
          permissions,
          events,
          logger,
        });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({ path: '/', allow: 'user-cookie' });
      },
    });
  },
});
