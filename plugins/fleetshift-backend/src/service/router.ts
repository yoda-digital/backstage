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
import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import { Config } from '@backstage/config';
import type { EventsService } from '@backstage/plugin-events-node';
import {
  AiAgentShiftConfig,
  CreateShiftRequest,
  NpmShiftConfig,
  OpenRewriteShiftConfig,
  ShiftConfig,
  ShiftTarget,
  ShiftType,
} from '@backstage/plugin-fleetshift-common';
import { ShiftStore } from '../database/ShiftStore';
import { ShiftEngine } from './ShiftEngine';

const VALID_SHIFT_TYPES: ShiftType[] = [
  'ai-agent',
  'npm-package',
  'openrewrite',
];

function assertValidConfig(shiftType: ShiftType, config: ShiftConfig): void {
  switch (shiftType) {
    case 'ai-agent': {
      const c = config as Partial<AiAgentShiftConfig>;
      if (!c.prompt) {
        throw new InputError('ai-agent shifts require a config.prompt');
      }
      return;
    }
    case 'npm-package': {
      const c = config as Partial<NpmShiftConfig>;
      if (!c.packageName || !c.fromVersion || !c.toVersion) {
        throw new InputError(
          'npm-package shifts require config.packageName, config.fromVersion, and config.toVersion',
        );
      }
      return;
    }
    case 'openrewrite': {
      const c = config as Partial<OpenRewriteShiftConfig>;
      if (!c.recipeName || !c.recipeVersion) {
        throw new InputError(
          'openrewrite shifts require config.recipeName and config.recipeVersion',
        );
      }
      return;
    }
    default:
      throw new InputError(`Unknown shift type ${shiftType}`);
  }
}

function parseTargetIndex(
  raw: string,
  targets: ReadonlyArray<unknown>,
): number {
  const targetIndex = Number(raw);
  if (
    !Number.isInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex >= targets.length
  ) {
    throw new NotFoundError(`No target with index ${raw}`);
  }
  return targetIndex;
}

/** @internal */
export interface RouterOptions {
  store: ShiftStore;
  engine: ShiftEngine;
  httpAuth: HttpAuthService;
  logger: LoggerService;
  config: Config;
  events: EventsService;
}

/**
 * Publishes an audit event to the `audit` topic for the fleetshift plugin.
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
      pluginId: 'fleetshift',
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
  const { store, engine, httpAuth, logger, config, events } = options;
  const router = Router();
  router.use(express.json());

  router.get('/shifts', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const shifts = await store.listShifts();
    res.json(shifts);
  });

  router.get('/shifts/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const shift = await store.getShift(req.params.id);
    if (!shift) {
      throw new NotFoundError(`No shift found with id ${req.params.id}`);
    }
    res.json(shift);
  });

  router.post('/shifts', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const {
      title,
      description,
      transformation,
      targets,
      shiftType,
      config: shiftConfig,
    } = req.body as Partial<CreateShiftRequest>;
    if (
      !title ||
      !transformation ||
      !Array.isArray(targets) ||
      targets.length === 0
    ) {
      throw new InputError(
        'title, transformation, and a non-empty targets array are required',
      );
    }
    const resolvedShiftType: ShiftType = shiftType ?? 'ai-agent';
    if (!VALID_SHIFT_TYPES.includes(resolvedShiftType)) {
      throw new InputError(`Unknown shift type ${resolvedShiftType}`);
    }
    const resolvedConfig: ShiftConfig =
      shiftConfig ?? ({ prompt: transformation } as AiAgentShiftConfig);
    assertValidConfig(resolvedShiftType, resolvedConfig);

    const createdBy = requireUserRef(credentials);
    const shift = await store.createShift(
      {
        title,
        description: description ?? '',
        transformation,
        shiftType: resolvedShiftType,
        config: resolvedConfig,
        targets: targets as ShiftTarget[],
      },
      createdBy,
    );
    await publishAudit(events, {
      action: 'fleetshift.shift.create',
      actor: createdBy,
      entityRef: shift.id,
    });
    res.status(201).json(shift);
  });

  router.post('/shifts/:id/plan', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const actor = requireUserRef(credentials);
    const shift = await store.getShift(req.params.id);
    if (!shift) {
      throw new NotFoundError(`No shift found with id ${req.params.id}`);
    }
    await engine.planShift(req.params.id);
    await publishAudit(events, {
      action: 'fleetshift.shift.plan',
      actor,
      entityRef: req.params.id,
    });
    const updated = await store.getShift(req.params.id);
    res.json(updated);
  });

  router.post('/shifts/:id/execute', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const actor = requireUserRef(credentials);
    const shift = await store.getShift(req.params.id);
    if (!shift) {
      throw new NotFoundError(`No shift found with id ${req.params.id}`);
    }
    // Execution runs asynchronously; the response reflects the shift
    // immediately after the transition to "executing" is recorded.
    engine.executeShift(req.params.id).catch(error => {
      logger.error(`Shift execution failed for ${req.params.id}: ${error}`);
    });
    await publishAudit(events, {
      action: 'fleetshift.shift.execute',
      actor,
      entityRef: req.params.id,
      severity: 'high',
    });
    res.status(202).json({ shiftId: req.params.id, status: 'executing' });
  });

  router.get('/shifts/:id/targets/:targetIndex/logs', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const shift = await store.getShift(req.params.id);
    if (!shift) {
      throw new NotFoundError(`No shift found with id ${req.params.id}`);
    }
    const targetIndex = parseTargetIndex(req.params.targetIndex, shift.targets);
    const logs = await store.getLogs(req.params.id, targetIndex);
    res.json(logs);
  });

  router.get('/shifts/:id/targets/:targetIndex/diff', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const shift = await store.getShift(req.params.id);
    if (!shift) {
      throw new NotFoundError(`No shift found with id ${req.params.id}`);
    }
    const targetIndex = parseTargetIndex(req.params.targetIndex, shift.targets);
    const diff = await store.getDiff(req.params.id, targetIndex);
    res.json(
      diff ?? { targetRepoUrl: shift.targets[targetIndex].repoUrl, files: [] },
    );
  });

  router.post('/shifts/:id/targets/:targetIndex/retry', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const actor = requireUserRef(credentials);
    const shift = await store.getShift(req.params.id);
    if (!shift) {
      throw new NotFoundError(`No shift found with id ${req.params.id}`);
    }
    const targetIndex = parseTargetIndex(req.params.targetIndex, shift.targets);
    // Execution runs asynchronously; see the /execute route above.
    engine.executeTarget(req.params.id, targetIndex).catch(error => {
      logger.error(
        `Target retry failed for shift ${req.params.id}, target ${targetIndex}: ${error}`,
      );
    });
    await publishAudit(events, {
      action: 'fleetshift.shift.target.retry',
      actor,
      entityRef: `${req.params.id}:${targetIndex}`,
      severity: 'high',
    });
    res.status(202).json({
      shiftId: req.params.id,
      targetIndex,
      status: 'executing',
    });
  });

  const middleware = MiddlewareFactory.create({ config, logger });
  router.use(middleware.error());
  return router;
}
