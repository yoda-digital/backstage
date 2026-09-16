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
  AuthService,
  HttpAuthService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';
import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import { Config } from '@backstage/config';
import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { CatalogService } from '@backstage/plugin-catalog-node';
import { NotificationService } from '@backstage/plugin-notifications-node';
import type { EventsService } from '@backstage/plugin-events-node';
import { DatasetMetadata } from '@backstage/plugin-data-experience-common';
import { WarehouseConnector } from '@backstage/plugin-data-experience-node';
import { AccessRequestStore } from './AccessRequestStore';
import { DatasetStore } from '../database/DatasetStore';

/** @internal */
export interface RouterOptions {
  store: DatasetStore;
  accessRequestStore: AccessRequestStore;
  connectors: WarehouseConnector[];
  catalog: CatalogService;
  auth: AuthService;
  httpAuth: HttpAuthService;
  logger: LoggerService;
  config: Config;
  notifications: NotificationService;
  events: EventsService;
}

/**
 * Publishes an audit event to the `audit` topic for the data-experience
 * plugin.
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
      pluginId: 'data-experience',
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Refreshes the metadata for a single dataset entity using the warehouse
 * connector registered for its `spec.warehouse`, persisting the result.
 *
 * @internal
 */
export async function refreshDatasetMetadata(
  entity: Entity,
  connectors: WarehouseConnector[],
  store: DatasetStore,
): Promise<DatasetMetadata | undefined> {
  const spec = entity.spec as
    | { warehouse?: string; schema?: string; table?: string }
    | undefined;
  const warehouseId = spec?.warehouse;
  const connector = connectors.find(c => c.connectorId === warehouseId);
  if (!connector) {
    return undefined;
  }

  const datasetName = spec?.table ?? entity.metadata.name;
  const metadata = await connector.getMetadata(datasetName);
  const enriched: DatasetMetadata = {
    ...metadata,
    entityRef: stringifyEntityRef(entity),
  };
  await store.setMetadata(enriched);
  return enriched;
}

function getUserRef(credentials: { principal: unknown }): string {
  const principal = credentials.principal as { userEntityRef?: string };
  if (!principal.userEntityRef) {
    throw new NotAllowedError(
      'Only authenticated users can perform this action',
    );
  }
  return principal.userEntityRef;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** @internal */
export function createRouter(options: RouterOptions) {
  const {
    store,
    accessRequestStore,
    connectors,
    catalog,
    auth,
    httpAuth,
    logger,
    config,
    notifications,
    events,
  } = options;
  const router = Router();
  router.use(express.json());

  router.get('/datasets', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const credentials = await auth.getOwnServiceCredentials();
    const { items } = await catalog.getEntities(
      { filter: { kind: 'Dataset' } },
      { credentials },
    );
    res.json(items);
  });

  router.get('/datasets/:entityRef/metadata', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const entityRef = decodeURIComponent(req.params.entityRef);
    const metadata = await store.getMetadata(entityRef);
    if (!metadata) {
      throw new NotFoundError(`No metadata found for dataset ${entityRef}`);
    }
    res.json(metadata);
  });

  router.post('/datasets/:entityRef/refresh', async (req, res) => {
    const httpCredentials = await httpAuth.credentials(req, {
      allow: ['user'],
    });
    const actor = getUserRef(httpCredentials);
    const entityRef = decodeURIComponent(req.params.entityRef);
    const credentials = await auth.getOwnServiceCredentials();
    const entity = await catalog.getEntityByRef(entityRef, { credentials });
    if (!entity) {
      throw new NotFoundError(`No dataset entity found for ${entityRef}`);
    }

    const metadata = await refreshDatasetMetadata(entity, connectors, store);
    if (!metadata) {
      throw new InputError(
        `No warehouse connector registered for dataset ${entityRef}`,
      );
    }

    logger.info(`Refreshed metadata for dataset ${entityRef}`);
    await publishAudit(events, {
      action: 'data-experience.dataset.refresh',
      actor,
      entityRef,
      severity: 'low',
    });
    res.status(200).json(metadata);
  });

  router.get('/warehouses', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const warehouses =
      config.getOptionalConfigArray('dataExperience.warehouses') ?? [];
    res.json(
      warehouses.map(warehouse => ({
        id: warehouse.getString('id'),
        type: warehouse.getString('type'),
        displayName: warehouse.getString('displayName'),
      })),
    );
  });

  router.post('/access-requests', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const requestedBy = getUserRef(credentials);
    const { datasetRef, reason } = req.body as {
      datasetRef?: string;
      reason?: string;
    };
    if (!datasetRef || !reason) {
      throw new InputError('datasetRef and reason are required');
    }

    const request = await accessRequestStore.create(
      datasetRef,
      requestedBy,
      reason,
    );

    const owner = await getDatasetOwnerRef(datasetRef, catalog, auth);
    if (owner) {
      try {
        await notifications.send({
          recipients: { type: 'entity', entityRef: [owner] },
          payload: {
            title: `Access requested for ${datasetRef}`,
            description: `${requestedBy} requested access to ${datasetRef}: ${reason}`,
            severity: 'normal',
            topic: 'data-experience-access-request',
            link: `/data-experience/${encodeURIComponent(datasetRef)}`,
          },
        });
      } catch (error) {
        logger.warn(`Failed to send access request notification: ${error}`);
      }
    }

    logger.info(`Created access request ${request.id} for ${datasetRef}`);
    await publishAudit(events, {
      action: 'data-experience.access-request.create',
      actor: requestedBy,
      entityRef: datasetRef,
      metadata: { requestId: request.id },
    });
    res.status(201).json(request);
  });

  router.get('/access-requests', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const datasetRef = asOptionalString(req.query.datasetRef);
    const requests = await accessRequestStore.list(datasetRef);
    res.json(requests);
  });

  router.post('/access-requests/:id/approve', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const approver = getUserRef(credentials);
    const request = await accessRequestStore.setStatus(
      req.params.id,
      'approved',
    );
    await notifyRequester(request, `${approver} approved your access request`);
    await publishAudit(events, {
      action: 'data-experience.access-request.approve',
      actor: approver,
      entityRef: request.datasetRef,
      metadata: { requestId: req.params.id },
      severity: 'high',
    });
    res.status(200).json(request);
  });

  router.post('/access-requests/:id/deny', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const approver = getUserRef(credentials);
    const request = await accessRequestStore.setStatus(req.params.id, 'denied');
    await notifyRequester(request, `${approver} denied your access request`);
    await publishAudit(events, {
      action: 'data-experience.access-request.deny',
      actor: approver,
      entityRef: request.datasetRef,
      metadata: { requestId: req.params.id },
      severity: 'high',
    });
    res.status(200).json(request);
  });

  router.post('/access-requests/:id/comment', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const authorRef = getUserRef(credentials);
    const { message } = req.body as { message?: string };
    if (!message) {
      throw new InputError('message is required');
    }
    const request = await accessRequestStore.addComment(req.params.id, {
      authorRef,
      message,
      createdAt: new Date().toISOString(),
    });
    await publishAudit(events, {
      action: 'data-experience.access-request.comment',
      actor: authorRef,
      entityRef: request.datasetRef,
      metadata: { requestId: req.params.id },
      severity: 'low',
    });
    res.status(200).json(request);
  });

  async function notifyRequester(
    request: { requestedBy: string; datasetRef: string; status: string },
    description: string,
  ): Promise<void> {
    try {
      await notifications.send({
        recipients: { type: 'entity', entityRef: [request.requestedBy] },
        payload: {
          title: `Access request ${request.status}: ${request.datasetRef}`,
          description,
          severity: request.status === 'approved' ? 'normal' : 'high',
          topic: 'data-experience-access-request',
        },
      });
    } catch (error) {
      logger.warn(
        `Failed to send access request status notification: ${error}`,
      );
    }
  }

  const middleware = MiddlewareFactory.create({ config, logger });
  router.use(middleware.error());
  return router;
}

async function getDatasetOwnerRef(
  datasetRef: string,
  catalog: CatalogService,
  auth: AuthService,
): Promise<string | undefined> {
  const credentials = await auth.getOwnServiceCredentials();
  const entity = await catalog.getEntityByRef(datasetRef, { credentials });
  const spec = entity?.spec as { owner?: string } | undefined;
  return spec?.owner;
}
