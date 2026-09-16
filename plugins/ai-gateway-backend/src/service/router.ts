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
import { InputError, NotAllowedError } from '@backstage/errors';
import type { EventsService } from '@backstage/plugin-events-node';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import {
  AiChatRequest,
  aiGatewayChatPermission,
  aiGatewayUsageReadPermission,
} from '@backstage/plugin-ai-gateway-common';
import { ProviderManager } from './ProviderManager';
import { UsageTracker } from './UsageTracker';

/** @internal */
export interface RouterOptions {
  providerManager: ProviderManager;
  usageTracker: UsageTracker;
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
  logger: LoggerService;
  config: Config;
  events: EventsService;
}

/** @internal */
export function createRouter(options: RouterOptions) {
  const {
    providerManager,
    usageTracker,
    httpAuth,
    permissions,
    logger,
    events,
  } = options;
  const router = Router();
  router.use(express.json());

  router.get('/providers', async (_req, res) => {
    const providers = await providerManager.listProviders();
    res.json(providers);
  });

  router.get('/models', async (_req, res) => {
    const models = await providerManager.listAllModels();
    res.json(models);
  });

  router.post('/chat', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });

    const decision = (
      await permissions.authorize([{ permission: aiGatewayChatPermission }], {
        credentials,
      })
    )[0];
    if (decision.result === AuthorizeResult.DENY) {
      throw new NotAllowedError('Unauthorized');
    }

    const principal = credentials.principal as { userEntityRef?: string };
    const userEntityRef = principal.userEntityRef ?? 'unknown';

    const chatRequest = req.body as AiChatRequest;
    if (!chatRequest || !Array.isArray(chatRequest.messages)) {
      throw new InputError('Request body must include a messages array');
    }

    const provider = chatRequest.modelId
      ? providerManager.getProviderForModel(chatRequest.modelId)
      : providerManager.getDefaultProvider();

    if (chatRequest.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let totalPrompt = 0;
      let totalCompletion = 0;
      for await (const chunk of provider.chatStream(chatRequest)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if (chunk.usage) {
          totalPrompt = chunk.usage.promptTokens;
          totalCompletion = chunk.usage.completionTokens;
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();

      await usageTracker.record({
        providerId: provider.providerId,
        modelId: chatRequest.modelId,
        userEntityRef,
        promptTokens: totalPrompt,
        completionTokens: totalCompletion,
      });
      await events.publish({
        topic: 'audit',
        eventPayload: {
          action: 'ai-gateway.chat.create',
          actor: userEntityRef,
          status: 'succeeded',
          severity: 'low',
          pluginId: 'ai-gateway',
          metadata: {
            providerId: provider.providerId,
            modelId: chatRequest.modelId,
            stream: true,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      const response = await provider.chat(chatRequest);
      await usageTracker.record({
        providerId: provider.providerId,
        modelId: chatRequest.modelId,
        userEntityRef,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
      });
      await events.publish({
        topic: 'audit',
        eventPayload: {
          action: 'ai-gateway.chat.create',
          actor: userEntityRef,
          status: 'succeeded',
          severity: 'low',
          pluginId: 'ai-gateway',
          metadata: {
            providerId: provider.providerId,
            modelId: chatRequest.modelId,
            stream: false,
          },
          timestamp: new Date().toISOString(),
        },
      });
      res.json(response);
    }
  });

  router.get('/usage', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const decision = (
      await permissions.authorize(
        [{ permission: aiGatewayUsageReadPermission }],
        { credentials },
      )
    )[0];
    if (decision.result === AuthorizeResult.DENY) {
      throw new NotAllowedError('Unauthorized');
    }

    const records = await usageTracker.query({
      providerId: req.query.providerId as string | undefined,
      modelId: req.query.modelId as string | undefined,
      userEntityRef: req.query.userEntityRef as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });
    res.json(records);
  });

  router.get('/usage/summary', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const decision = (
      await permissions.authorize(
        [{ permission: aiGatewayUsageReadPermission }],
        { credentials },
      )
    )[0];
    if (decision.result === AuthorizeResult.DENY) {
      throw new NotAllowedError('Unauthorized');
    }

    const summary = await usageTracker.summarize({
      providerId: req.query.providerId as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    });
    res.json(summary);
  });

  const middleware = MiddlewareFactory.create({
    config: options.config,
    logger,
  });
  router.use(middleware.error());
  return router;
}
