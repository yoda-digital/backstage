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
  resolvePackagePath,
} from '@backstage/backend-plugin-api';
import { eventsServiceRef } from '@backstage/plugin-events-node';
import { createRouter } from './service/router';
import { RuleStore } from './service/RuleStore';
import { SkillStore } from './service/SkillStore';
import { PluginStore } from './service/PluginStore';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-ai-explorer-backend',
  'migrations',
);

/**
 * The AI Explorer backend plugin. Indexes AI guardrail rules and prompt
 * skills, and maintains an MCP plugin/server marketplace registry.
 *
 * @public
 */
export const aiExplorerPlugin = createBackendPlugin({
  pluginId: 'ai-explorer',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        events: eventsServiceRef,
      },
      async init({ config, logger, database, httpRouter, httpAuth, events }) {
        const knex = await database.getClient();
        await knex.migrate.latest({ directory: migrationsDir, tableName: 'knex_migrations_ai_explorer' });

        const ruleStore = new RuleStore(knex);
        const skillStore = new SkillStore(knex);
        const pluginStore = new PluginStore(knex);

        const router = createRouter({
          ruleStore,
          skillStore,
          pluginStore,
          httpAuth,
          logger,
          config,
          events,
        });

        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/plugins',
          allow: 'unauthenticated',
        });

        logger.info('AI Explorer plugin initialized');
      },
    });
  },
});
