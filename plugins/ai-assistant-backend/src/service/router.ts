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

import express from 'express';
import Router from 'express-promise-router';
import {
  HttpAuthService,
  LoggerService,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';
import { Config } from '@backstage/config';
import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import type { EventsService } from '@backstage/plugin-events-node';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import {
  AiMode,
  CreateConversationRequest,
  CreateModeRequest,
  KnowledgeChunk,
  SendMessageRequest,
  UpdateModeRequest,
  aiAssistantChatPermission,
} from '@backstage/plugin-ai-assistant-common';
import { ConversationStore } from './ConversationStore';
import { ModeRegistry } from './ModeRegistry';
import { ModeStore } from './ModeStore';
import { ProcessorPipeline } from './ProcessorPipeline';
import { SuggestionRegistry } from './SuggestionRegistry';
import { RagPipeline } from './RagPipeline';
import { AiGatewayClient } from './AiGatewayClient';

/** @internal */
export interface RouterOptions {
  conversationStore: ConversationStore;
  modeRegistry: ModeRegistry;
  modeStore: ModeStore;
  processorPipeline: ProcessorPipeline;
  suggestionRegistry: SuggestionRegistry;
  ragPipeline: RagPipeline;
  gatewayClient: AiGatewayClient;
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
  logger: LoggerService;
  config: Config;
  defaultModel: string;
  events: EventsService;
}

/**
 * Publishes an audit event to the `audit` topic for the ai-assistant plugin.
 */
async function publishAudit(
  events: EventsService,
  event: {
    action: string;
    actor: string;
    entityRef?: string;
    metadata?: Record<string, unknown>;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  },
): Promise<void> {
  await events.publish({
    topic: 'audit',
    eventPayload: {
      action: event.action,
      actor: event.actor,
      entityRef: event.entityRef,
      metadata: event.metadata,
      status: 'succeeded',
      severity: event.severity ?? 'medium',
      pluginId: 'ai-assistant',
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Wraps a built-in, config-defined mode as a read-only {@link AiMode} so it
 * shows up alongside user-created modes in `GET /modes`. Built-in modes have
 * no owner and cannot be edited or deleted.
 */
function builtInModeToAiMode(mode: {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  modelId?: string;
}): AiMode {
  return {
    id: mode.id,
    name: mode.name,
    description: mode.description,
    instructions: mode.systemPrompt,
    visibility: 'public',
    ownerRef: 'system:built-in',
    processors: [],
    modelOverride: mode.modelId,
    usageCount30d: 0,
    builtIn: true,
    createdAt: '',
    updatedAt: '',
  };
}

/** @internal */
export function createRouter(options: RouterOptions) {
  const {
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
    defaultModel,
    events,
  } = options;
  const router = Router();
  router.use(express.json());

  async function optionalUserRef(
    req: express.Request,
  ): Promise<string | undefined> {
    const credentials = await httpAuth.credentials(req, {
      allow: ['user', 'none'],
    });
    const principal = credentials.principal as { userEntityRef?: string };
    return principal.userEntityRef;
  }

  router.get('/modes', async (req, res) => {
    const userEntityRef = await optionalUserRef(req);
    const customModes = await modeStore.list(userEntityRef);
    res.json([
      ...modeRegistry.listModes().map(builtInModeToAiMode),
      ...customModes,
    ]);
  });

  router.post('/modes', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const principal = credentials.principal as { userEntityRef?: string };
    if (!principal.userEntityRef) {
      throw new NotAllowedError(
        'Only authenticated users can perform this action',
      );
    }
    const body = req.body as CreateModeRequest;
    if (!body?.name || !body?.instructions || !body?.visibility) {
      throw new InputError(
        'Request body must include name, instructions, and visibility',
      );
    }
    const mode = await modeStore.create(principal.userEntityRef, body);
    await publishAudit(events, {
      action: 'ai-assistant.mode.create',
      actor: principal.userEntityRef,
      entityRef: mode.id,
    });
    res.status(201).json(mode);
  });

  router.get('/modes/popular', async (req, res) => {
    const userEntityRef = await optionalUserRef(req);
    const limit = req.query.limit ? Number(req.query.limit) : 5;
    res.json(await modeStore.popular(userEntityRef, limit));
  });

  router.get('/suggestions', async (req, res) => {
    const route = typeof req.query.route === 'string' ? req.query.route : '';
    res.json(suggestionRegistry.forRoute(route));
  });

  router.get('/modes/:id', async (req, res) => {
    const userEntityRef = await optionalUserRef(req);
    const builtIn = modeRegistry.getMode(req.params.id);
    if (builtIn) {
      res.json(builtInModeToAiMode(builtIn));
      return;
    }
    const mode = await modeStore.get(req.params.id, userEntityRef);
    if (!mode) {
      throw new NotFoundError(`Mode '${req.params.id}' not found`);
    }
    res.json(mode);
  });

  router.put('/modes/:id', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const principal = credentials.principal as { userEntityRef?: string };
    if (!principal.userEntityRef) {
      throw new NotAllowedError(
        'Only authenticated users can perform this action',
      );
    }
    const body = req.body as UpdateModeRequest;
    const mode = await modeStore.update(
      req.params.id,
      principal.userEntityRef,
      body,
    );
    await publishAudit(events, {
      action: 'ai-assistant.mode.update',
      actor: principal.userEntityRef,
      entityRef: req.params.id,
    });
    res.json(mode);
  });

  router.delete('/modes/:id', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const principal = credentials.principal as { userEntityRef?: string };
    if (!principal.userEntityRef) {
      throw new NotAllowedError(
        'Only authenticated users can perform this action',
      );
    }
    await modeStore.delete(req.params.id, principal.userEntityRef);
    await publishAudit(events, {
      action: 'ai-assistant.mode.delete',
      actor: principal.userEntityRef,
      entityRef: req.params.id,
      severity: 'critical',
    });
    res.status(204).end();
  });

  router.post('/conversations', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const principal = credentials.principal as { userEntityRef?: string };
    if (!principal.userEntityRef) {
      throw new NotAllowedError(
        'Only authenticated users can perform this action',
      );
    }
    const body = req.body as CreateConversationRequest;
    if (!body?.modeId) {
      throw new InputError('Request body must include a modeId');
    }
    const conversation = await conversationStore.create({
      title: body.title ?? 'New conversation',
      modeId: body.modeId,
      userEntityRef: principal.userEntityRef,
    });
    await publishAudit(events, {
      action: 'ai-assistant.conversation.create',
      actor: principal.userEntityRef,
      entityRef: conversation.id,
      severity: 'low',
    });
    res.status(201).json(conversation);
  });

  router.get('/conversations', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const principal = credentials.principal as { userEntityRef?: string };
    const conversations = await conversationStore.list({
      userEntityRef: principal.userEntityRef,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    res.json(conversations);
  });

  router.get('/conversations/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const conversation = await conversationStore.get(req.params.id);
    if (!conversation) {
      throw new NotFoundError(`Conversation '${req.params.id}' not found`);
    }
    res.json(conversation);
  });

  router.post('/conversations/:id/messages', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const decision = (
      await permissions.authorize([{ permission: aiAssistantChatPermission }], {
        credentials,
      })
    )[0];
    if (decision.result === AuthorizeResult.DENY) {
      throw new NotAllowedError('Unauthorized');
    }

    const body = req.body as SendMessageRequest;
    if (!body?.content) {
      throw new InputError('Request body must include content');
    }

    const conversation = await conversationStore.get(req.params.id);
    if (!conversation) {
      throw new NotFoundError(`Conversation '${req.params.id}' not found`);
    }

    await conversationStore.addMessage(req.params.id, {
      role: 'user',
      content: body.content,
    });

    const principal = credentials.principal as { userEntityRef?: string };
    const aiMode = body.modeId
      ? await modeStore.get(body.modeId, principal.userEntityRef)
      : undefined;

    let assistantContent: string;
    let sources: KnowledgeChunk[] | undefined;
    let classification: string | undefined;
    let confidence: 'low' | 'medium' | 'high' | undefined;

    if (aiMode) {
      // A processor-pipeline AiKA mode was explicitly selected for this
      // message: run its pipeline instead of the default RAG-based flow.
      const result = await processorPipeline.run({
        mode: aiMode,
        pageContext: body.pageContext,
        history: conversation.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        userMessage: body.content,
        defaultModel,
      });
      assistantContent = result.content;
      classification = result.classification;
      confidence = result.confidence;
      await modeStore.recordUsage(aiMode.id);
    } else {
      const mode = modeRegistry.getMode(conversation.modeId);
      const chunks = mode ? await ragPipeline.retrieve(body.content, mode) : [];
      const context = ragPipeline.buildContext(chunks);
      const modelId = mode?.modelId ?? defaultModel;
      const systemPrompt = (mode?.systemPrompt ?? '') + context;

      const aiResponse = await gatewayClient.chat({
        modelId,
        system: systemPrompt,
        messages: [
          ...conversation.messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user' as const, content: body.content },
        ],
        maxTokens: 4096,
        stream: false,
      });
      assistantContent = aiResponse.content;
      sources = chunks.length > 0 ? chunks : undefined;
    }

    const assistantMessage = await conversationStore.addMessage(req.params.id, {
      role: 'assistant',
      content: assistantContent,
      sources,
    });

    logger.info(`Assistant replied in conversation ${req.params.id}`);
    const messagePrincipal = credentials.principal as {
      userEntityRef?: string;
    };
    await publishAudit(events, {
      action: 'ai-assistant.conversation.message.create',
      actor: messagePrincipal.userEntityRef ?? 'unknown',
      entityRef: req.params.id,
      severity: 'low',
    });
    res.status(201).json({ ...assistantMessage, classification, confidence });
  });

  const middleware = MiddlewareFactory.create({
    config: options.config,
    logger,
  });
  router.use(middleware.error());
  return router;
}
