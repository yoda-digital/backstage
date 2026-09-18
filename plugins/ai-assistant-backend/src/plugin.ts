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
import {
  aiKnowledgeSourceExtensionPoint,
  aiSuggestionsExtensionPoint,
} from '@backstage/plugin-ai-assistant-node';
import { eventsServiceRef } from '@backstage/plugin-events-node';
import { createRouter } from './service/router';
import { ConversationStore } from './service/ConversationStore';
import { ModeRegistry } from './service/ModeRegistry';
import { ModeStore } from './service/ModeStore';
import { ProcessorPipeline } from './service/ProcessorPipeline';
import { SuggestionRegistry } from './service/SuggestionRegistry';
import { RagPipeline } from './service/RagPipeline';
import { KnowledgeSourceManager } from './service/KnowledgeSourceManager';
import { AiGatewayClient } from './service/AiGatewayClient';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-ai-assistant-backend',
  'migrations',
);

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/**
 * The AI Assistant backend plugin. Manages conversations, assistant modes,
 * and a retrieval-augmented generation (RAG) pipeline over registered
 * knowledge sources, delegating model calls to the AI Gateway backend.
 *
 * @public
 */
export const aiAssistantPlugin = createBackendPlugin({
  pluginId: 'ai-assistant',
  register(env) {
    const knowledgeSourceManager = new KnowledgeSourceManager();
    const suggestionRegistry = new SuggestionRegistry();

    env.registerExtensionPoint(
      aiKnowledgeSourceExtensionPoint,
      knowledgeSourceManager,
    );
    env.registerExtensionPoint(aiSuggestionsExtensionPoint, suggestionRegistry);

    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        permissions: coreServices.permissions,
        events: eventsServiceRef,
      },
      async init({
        config,
        logger,
        database,
        discovery,
        auth,
        httpRouter,
        httpAuth,
        permissions,
        events,
      }) {
        const knex = await database.getClient();
        await knex.migrate.latest({ directory: migrationsDir, tableName: 'knex_migrations_ai_assistant' });

        const conversationStore = new ConversationStore(knex);
        const modeRegistry = new ModeRegistry(config);
        const modeStore = ModeStore.create(knex);
        const ragPipeline = new RagPipeline(knowledgeSourceManager, logger);
        const gatewayClient = AiGatewayClient.create({ discovery, auth });
        const processorPipeline = ProcessorPipeline.create({
          gatewayClient,
          logger,
        });
        const defaultModel =
          config.getOptionalString('aiAssistant.defaultModel') ?? DEFAULT_MODEL;

        const router = createRouter({
          conversationStore,
          modeRegistry,
          modeStore,
          processorPipeline,
          suggestionRegistry,
          ragPipeline,
          gatewayClient,
          httpAuth,
          permissions,
          logger,
          config,
          defaultModel,
          events,
        });

        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/modes',
          allow: 'unauthenticated',
        });

        logger.info('AI Assistant plugin initialized');
      },
    });
  },
});
