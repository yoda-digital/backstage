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
import { OverlayPatch } from '@backstage/plugin-entity-overlays-common';
import { OverlayStore } from '../database/OverlayStore';

const SUPPORTED_EXACT_PATHS = new Set(['metadata.tags', 'spec.lifecycle']);
const SUPPORTED_PREFIXES = ['metadata.annotations.', 'metadata.labels.'];

function isSupportedOverlayPath(path: string): boolean {
  return (
    SUPPORTED_EXACT_PATHS.has(path) ||
    SUPPORTED_PREFIXES.some(prefix => path.startsWith(prefix))
  );
}

/** @internal */
export interface RouterOptions {
  store: OverlayStore;
  httpAuth: HttpAuthService;
  logger: LoggerService;
  config: Config;
  events: EventsService;
}

/**
 * Publishes an audit event to the `audit` topic for the entity-overlays
 * plugin.
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
      pluginId: 'entity-overlays',
      timestamp: new Date().toISOString(),
    },
  });
}

/** @internal */
export function createRouter(options: RouterOptions) {
  const { store, httpAuth, logger, events } = options;
  const router = Router();
  router.use(express.json());

  router.get('/overlays', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const overlays = await store.listOverlays();
    res.json(overlays);
  });

  router.get('/overlays/:entityRef', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const entityRef = decodeURIComponent(req.params.entityRef);
    const overlay = await store.getOverlay(entityRef);
    if (!overlay) {
      throw new NotFoundError(`No overlay found for entity ${entityRef}`);
    }
    res.json(overlay);
  });

  router.put('/overlays/:entityRef', async (req, res) => {
    const credentials = await httpAuth.credentials(req, {
      allow: ['user'],
    });
    const entityRef = decodeURIComponent(req.params.entityRef);
    const { patches } = req.body as { patches?: OverlayPatch[] };
    if (!Array.isArray(patches)) {
      throw new InputError('patches must be an array');
    }
    const unsupported = patches.find(
      patch => !isSupportedOverlayPath(patch.path),
    );
    if (unsupported) {
      throw new InputError(
        `Unsupported overlay path "${unsupported.path}". Supported paths are metadata.tags, spec.lifecycle, metadata.annotations.*, and metadata.labels.*`,
      );
    }
    const principal = credentials.principal as { userEntityRef?: string };
    if (!principal.userEntityRef) {
      throw new NotAllowedError(
        'Only authenticated users can perform this action',
      );
    }
    const updatedBy = principal.userEntityRef;
    await store.setOverlay(entityRef, patches, updatedBy);
    logger.info(`Updated overlay for ${entityRef} by ${updatedBy}`);
    await publishAudit(events, {
      action: 'entity-overlays.overlay.set',
      actor: updatedBy,
      entityRef,
      severity: 'high',
    });
    res.status(200).json({ entityRef, patchesApplied: patches.length });
  });

  router.delete('/overlays/:entityRef', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const principal = credentials.principal as { userEntityRef?: string };
    if (!principal.userEntityRef) {
      throw new NotAllowedError(
        'Only authenticated users can perform this action',
      );
    }
    const entityRef = decodeURIComponent(req.params.entityRef);
    await store.deleteOverlay(entityRef);
    await publishAudit(events, {
      action: 'entity-overlays.overlay.delete',
      actor: principal.userEntityRef,
      entityRef,
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
