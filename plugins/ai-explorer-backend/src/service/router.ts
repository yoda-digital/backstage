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
import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';
import { Config } from '@backstage/config';
import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import type { EventsService } from '@backstage/plugin-events-node';
import {
  AiRuleQuery,
  AiSkillQuery,
} from '@backstage/plugin-ai-explorer-common';
import { RuleStore } from './RuleStore';
import { SkillStore } from './SkillStore';
import { PluginStore } from './PluginStore';

/** @internal */
export interface RouterOptions {
  ruleStore: RuleStore;
  skillStore: SkillStore;
  pluginStore: PluginStore;
  httpAuth: HttpAuthService;
  logger: LoggerService;
  config: Config;
  events: EventsService;
}

/**
 * Publishes an audit event to the `audit` topic for the ai-explorer plugin.
 */
async function publishAudit(
  events: EventsService,
  event: {
    action: string;
    actor: string;
    entityRef?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  },
): Promise<void> {
  await events.publish({
    topic: 'audit',
    eventPayload: {
      action: event.action,
      actor: event.actor,
      entityRef: event.entityRef,
      status: 'succeeded',
      severity: event.severity ?? 'medium',
      pluginId: 'ai-explorer',
      timestamp: new Date().toISOString(),
    },
  });
}

/** Verifies the caller is an authenticated user, returning their entity ref. */
function requireUserRef(credentials: { principal: unknown }): string {
  const principal = credentials.principal as { userEntityRef?: string };
  if (!principal.userEntityRef) {
    throw new NotAllowedError(
      'Only authenticated users can perform this action',
    );
  }
  return principal.userEntityRef;
}

/** @internal */
export function createRouter(options: RouterOptions) {
  const { ruleStore, skillStore, pluginStore, httpAuth, logger, events } =
    options;
  const router = Router();
  router.use(express.json());

  // Rules CRUD
  router.get('/rules', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const query: AiRuleQuery = {
      type: req.query.type as AiRuleQuery['type'],
      enabled:
        req.query.enabled !== undefined
          ? req.query.enabled === 'true'
          : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    };
    res.json(await ruleStore.list(query));
  });

  router.post('/rules', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const actor = requireUserRef(credentials);
    const { name, description, type, config, enabled } = req.body ?? {};
    if (!name || !description || !type) {
      throw new InputError('name, description, and type are required');
    }
    const rule = await ruleStore.create({
      name,
      description,
      type,
      config: config ?? {},
      enabled: enabled ?? true,
    });
    await publishAudit(events, {
      action: 'ai-explorer.rule.create',
      actor,
      entityRef: rule.id,
      severity: 'high',
    });
    res.status(201).json(rule);
  });

  router.put('/rules/:id', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const actor = requireUserRef(credentials);
    const existing = await ruleStore.get(req.params.id);
    if (!existing) {
      throw new NotFoundError(`Rule '${req.params.id}' not found`);
    }
    await ruleStore.update(req.params.id, req.body ?? {});
    await publishAudit(events, {
      action: 'ai-explorer.rule.update',
      actor,
      entityRef: req.params.id,
      severity: 'high',
    });
    res.status(204).end();
  });

  router.delete('/rules/:id', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const actor = requireUserRef(credentials);
    await ruleStore.delete(req.params.id);
    await publishAudit(events, {
      action: 'ai-explorer.rule.delete',
      actor,
      entityRef: req.params.id,
      severity: 'critical',
    });
    res.status(204).end();
  });

  // Skills CRUD
  router.get('/skills', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const query: AiSkillQuery = {
      search: req.query.search as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    };
    res.json(await skillStore.list(query));
  });

  router.post('/skills', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const actor = requireUserRef(credentials);
    const { name, description, promptTemplate, variables, tags } =
      req.body ?? {};
    if (!name || !description || !promptTemplate) {
      throw new InputError(
        'name, description, and promptTemplate are required',
      );
    }
    const skill = await skillStore.create({
      name,
      description,
      promptTemplate,
      variables: variables ?? [],
      tags: tags ?? [],
    });
    await publishAudit(events, {
      action: 'ai-explorer.skill.create',
      actor,
      entityRef: skill.id,
    });
    res.status(201).json(skill);
  });

  router.put('/skills/:id', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const actor = requireUserRef(credentials);
    const existing = await skillStore.get(req.params.id);
    if (!existing) {
      throw new NotFoundError(`Skill '${req.params.id}' not found`);
    }
    await skillStore.update(req.params.id, req.body ?? {});
    await publishAudit(events, {
      action: 'ai-explorer.skill.update',
      actor,
      entityRef: req.params.id,
    });
    res.status(204).end();
  });

  router.delete('/skills/:id', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const actor = requireUserRef(credentials);
    await skillStore.delete(req.params.id);
    await publishAudit(events, {
      action: 'ai-explorer.skill.delete',
      actor,
      entityRef: req.params.id,
      severity: 'critical',
    });
    res.status(204).end();
  });

  // Plugins (MCP marketplace) CRUD
  router.get('/plugins', async (_req, res) => {
    res.json(await pluginStore.list());
  });

  router.post('/plugins', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const actor = requireUserRef(credentials);
    const { name, description, serverUrl, transport, tools, enabled } =
      req.body ?? {};
    if (!name || !description || !serverUrl || !transport) {
      throw new InputError(
        'name, description, serverUrl, and transport are required',
      );
    }
    const plugin = await pluginStore.create({
      name,
      description,
      serverUrl,
      transport,
      tools: tools ?? [],
      enabled: enabled ?? true,
    });
    await publishAudit(events, {
      action: 'ai-explorer.plugin.create',
      actor,
      entityRef: plugin.id,
      severity: 'high',
    });
    res.status(201).json(plugin);
  });

  router.delete('/plugins/:id', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const actor = requireUserRef(credentials);
    await pluginStore.delete(req.params.id);
    await publishAudit(events, {
      action: 'ai-explorer.plugin.delete',
      actor,
      entityRef: req.params.id,
      severity: 'critical',
    });
    res.status(204).end();
  });

  const middleware = MiddlewareFactory.create({
    config: options.config,
    logger,
  });
  router.use(middleware.error());
  return router;
}
