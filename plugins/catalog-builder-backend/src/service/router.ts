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
import { JobStore } from '../database/JobStore';
import { IngestionEngine } from './IngestionEngine';
import {
  CatalogBuilderProviderId,
  IngestRequest,
  RepositoryInfo,
} from '../types';

/** @internal */
export interface RouterOptions {
  store: JobStore;
  engine: IngestionEngine;
  httpAuth: HttpAuthService;
  logger: LoggerService;
  config: Config;
  events: EventsService;
}

function isProviderId(value: unknown): value is CatalogBuilderProviderId {
  return value === 'gitlab' || value === 'azure';
}

/**
 * Publishes an audit event to the `audit` topic for the catalog-builder
 * plugin.
 */
async function publishAudit(
  events: EventsService,
  event: {
    action: string;
    actor: string;
    entityRef?: string;
    metadata?: Record<string, unknown>;
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
      severity: 'medium',
      pluginId: 'catalog-builder',
      timestamp: new Date().toISOString(),
    },
  });
}

/** @internal */
export function createRouter(options: RouterOptions) {
  const { store, engine, httpAuth, logger, config, events } = options;
  const router = Router();
  router.use(express.json());

  router.get('/providers', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    res.json(engine.listProviders());
  });

  router.get('/organizations', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const { provider } = req.query;
    if (!isProviderId(provider)) {
      throw new InputError(
        'The provider query parameter must be gitlab or azure',
      );
    }
    const organizations = await engine.listOrganizations(provider);
    res.json(organizations);
  });

  router.get('/repositories', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const { provider, organization } = req.query;
    if (!isProviderId(provider)) {
      throw new InputError(
        'The provider query parameter must be gitlab or azure',
      );
    }
    if (typeof organization !== 'string' || !organization) {
      throw new InputError('The organization query parameter is required');
    }
    const repositories = await engine.listRepositories(provider, organization);
    res.json(repositories);
  });

  router.post('/ingest', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const body = req.body as Partial<IngestRequest>;
    if (
      !isProviderId(body.provider) ||
      typeof body.organization !== 'string' ||
      !body.organization ||
      (body.mode !== 'portal-managed' && body.mode !== 'yaml-managed') ||
      !Array.isArray(body.repositories) ||
      body.repositories.length === 0
    ) {
      throw new InputError(
        'provider, organization, mode, and a non-empty repositories array are required',
      );
    }

    const principal = credentials.principal as { userEntityRef?: string };
    if (!principal.userEntityRef) {
      throw new NotAllowedError(
        'Only authenticated users can perform this action',
      );
    }
    const createdBy = principal.userEntityRef;

    const job = await engine.startIngestion(
      {
        provider: body.provider,
        organization: body.organization,
        mode: body.mode,
        repositories: body.repositories as RepositoryInfo[],
        details: body.details,
      },
      createdBy,
    );
    await publishAudit(events, {
      action: 'catalog-builder.job.create',
      actor: createdBy,
      entityRef: job.id,
      metadata: {
        provider: body.provider,
        organization: body.organization,
        mode: body.mode,
      },
    });
    res.status(202).json(job);
  });

  router.get('/jobs/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const job = await store.getJob(req.params.id);
    if (!job) {
      throw new NotFoundError(
        `No catalog-builder job found with id ${req.params.id}`,
      );
    }
    res.json(job);
  });


  // Serve stored entity YAML for catalog.addLocation to fetch
  router.get('/entities/:name/catalog-info.yaml', async (req, res) => {
    const entityYaml = await store.getEntity(req.params.name);
    if (!entityYaml) {
      throw new NotFoundError(`No stored entity for ${req.params.name}`);
    }
    res.type('text/yaml').send(entityYaml);
  });

  const middleware = MiddlewareFactory.create({ config, logger });
  router.use(middleware.error());
  return router;
}
