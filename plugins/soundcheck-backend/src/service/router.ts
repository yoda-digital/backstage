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
import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import type { AuditEvent } from '@backstage/plugin-audit-log-common';
import type { EventsService } from '@backstage/plugin-events-node';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import type { BasicPermission } from '@backstage/plugin-permission-common';
import {
  SoundcheckCampaign,
  SoundcheckCheck,
  SoundcheckCheckResult,
  SoundcheckCheckStatus,
  SoundcheckTrack,
  soundcheckCampaignWritePermission,
  soundcheckCheckWritePermission,
  soundcheckExemptionWritePermission,
  soundcheckTrackWritePermission,
} from '@backstage/plugin-soundcheck-common';
import { DateTime } from 'luxon';
import yaml from 'js-yaml';
import { v4 as uuid } from 'uuid';
import { SoundcheckStore } from '../database/SoundcheckStore';
import { CheckEngine } from '../engine/CheckEngine';
import {
  buildCampaignMilestones,
  buildCheckInsights,
  buildPassRateTrend,
  buildTrackInsights,
  daysRemaining,
} from './insights';

/**
 * Extracts the caller's user entity ref from resolved credentials, for
 * attribution on exemption grants/revocations and audit events.
 */
function getUserRef(credentials: { principal: unknown }): string {
  const principal = credentials.principal as { userEntityRef?: string };
  return principal.userEntityRef ?? 'unknown';
}

/**
 * Publishes an audit event to the `audit` topic, following the
 * {@link AuditEvent} shape consumed by the audit-log backend.
 */
async function publishAudit(
  events: EventsService,
  event: {
    action: string;
    actor: string;
    entityRef?: string;
    metadata?: Record<string, unknown>;
    status?: AuditEvent['status'];
    severity?: AuditEvent['severity'];
  },
): Promise<void> {
  const payload: AuditEvent = {
    id: uuid(),
    action: event.action,
    actor: event.actor,
    entityRef: event.entityRef,
    metadata: event.metadata,
    timestamp: new Date().toISOString(),
    status: event.status ?? 'succeeded',
    severity: event.severity ?? 'low',
    pluginId: 'soundcheck',
  };
  await events.publish({ topic: 'audit', eventPayload: payload });
}

/**
 * Authorizes the given permission for the caller, throwing
 * `NotAllowedError` when denied.
 */
async function authorize(
  permissions: PermissionsService,
  credentials: Awaited<ReturnType<HttpAuthService['credentials']>>,
  permission: BasicPermission,
): Promise<void> {
  const decision = (
    await permissions.authorize([{ permission }], { credentials })
  )[0];
  if (decision.result === AuthorizeResult.DENY) {
    throw new NotAllowedError('Unauthorized');
  }
}

const MAX_CSV_ROWS = 5000;

/** Escapes a single CSV field, quoting it when it contains special characters. */
function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serializes rows of Soundcheck check results to CSV text. */
function resultsToCsv(results: SoundcheckCheckResult[]): string {
  const header = ['entityRef', 'status', 'message', 'evaluatedAt'];
  const lines = [header.join(',')];
  for (const result of results) {
    lines.push(
      [
        csvField(result.entityRef),
        csvField(result.status),
        csvField(result.message ?? ''),
        csvField(result.evaluatedAt),
      ].join(','),
    );
  }
  return lines.join('\n');
}

/** Validates a check document parsed from YAML (import or direct create). */
function assertValidCheck(value: unknown): asserts value is SoundcheckCheck {
  const check = value as Record<string, unknown> | null;
  if (
    typeof check !== 'object' ||
    check === null ||
    typeof check.id !== 'string' ||
    check.id.length === 0 ||
    typeof check.name !== 'string' ||
    typeof check.description !== 'string' ||
    typeof check.factRef !== 'string' ||
    typeof check.rule !== 'object' ||
    check.rule === null
  ) {
    throw new InputError(
      "each check must have string 'id', 'name', 'description', 'factRef', and an object 'rule'",
    );
  }
}

/** Validates a track document parsed from YAML (import or direct create). */
function assertValidTrack(value: unknown): asserts value is SoundcheckTrack {
  const track = value as Record<string, unknown> | null;
  if (
    typeof track !== 'object' ||
    track === null ||
    typeof track.id !== 'string' ||
    track.id.length === 0 ||
    typeof track.name !== 'string' ||
    typeof track.description !== 'string' ||
    !Array.isArray(track.levels)
  ) {
    throw new InputError(
      "each track must have string 'id', 'name', 'description', and an array 'levels'",
    );
  }
}

/** Validates a campaign document coming from a request body. */
function assertValidCampaign(
  value: unknown,
): asserts value is SoundcheckCampaign {
  const campaign = value as Record<string, unknown> | null;
  if (
    typeof campaign !== 'object' ||
    campaign === null ||
    typeof campaign.id !== 'string' ||
    campaign.id.length === 0 ||
    typeof campaign.name !== 'string' ||
    typeof campaign.description !== 'string' ||
    typeof campaign.trackId !== 'string' ||
    typeof campaign.targetLevel !== 'string' ||
    typeof campaign.startDate !== 'string' ||
    typeof campaign.endDate !== 'string'
  ) {
    throw new InputError(
      "campaign must have string 'id', 'name', 'description', 'trackId', 'targetLevel', 'startDate', and 'endDate'",
    );
  }
}

/**
 * Parses a request body expected to contain raw YAML, sent either as a
 * literal request body (Content-Type: text/yaml or application/x-yaml), or
 * as JSON `{ yaml: '<yaml>' }` (used by the Soundcheck frontend client), or
 * as JSON `{ content: '<yaml>' }`.
 */
function parseYamlBody(req: express.Request): unknown {
  const bodyRecord = req.body as { content?: unknown; yaml?: unknown };
  let raw: string | undefined;
  if (typeof req.body === 'string') {
    raw = req.body;
  } else if (typeof bodyRecord?.yaml === 'string') {
    raw = bodyRecord.yaml;
  } else if (typeof bodyRecord?.content === 'string') {
    raw = bodyRecord.content;
  }
  if (!raw) {
    throw new InputError(
      "Request body must be a YAML document, sent either raw (Content-Type: application/x-yaml or text/yaml) or as JSON { yaml: '<yaml>' }",
    );
  }
  try {
    return yaml.load(raw);
  } catch (e) {
    throw new InputError(
      `Invalid YAML: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/** Normalizes a parsed YAML import document into an array of entries. */
function toDocumentArray(parsed: unknown, key: string): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    Array.isArray((parsed as Record<string, unknown>)[key])
  ) {
    return (parsed as Record<string, unknown[]>)[key];
  }
  throw new InputError(
    `YAML document must be either an array or an object with a '${key}' array`,
  );
}

/**
 * @internal
 */
export interface RouterOptions {
  store: SoundcheckStore;
  engine: CheckEngine;
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
  events: EventsService;
  logger: LoggerService;
}

/**
 * Creates the Soundcheck REST API router, serving checks, tracks,
 * campaigns, and per-entity facts, results, and certifications.
 *
 * @internal
 */
export function createRouter(options: RouterOptions): express.Router {
  const { store, engine, httpAuth, permissions, events, logger } = options;
  const router = Router();
  router.use(express.json());

  router.get('/checks', async (_req, res) => {
    const checks = await store.getChecks();
    res.json(checks);
  });

  router.post('/checks', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    await authorize(permissions, credentials, soundcheckCheckWritePermission);
    const check = req.body;
    assertValidCheck(check);
    await store.upsertCheck(check);
    logger.info(`Created/updated Soundcheck check '${check.id}'`);
    await publishAudit(events, {
      action: 'soundcheck.check.write',
      actor: getUserRef(credentials),
      entityRef: `soundcheck-check:${check.id}`,
      metadata: { name: check.name },
    });
    res.status(201).json(check);
  });

  router.get('/checks/export', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const allChecks = await store.getChecks();
    const ids =
      typeof req.query.ids === 'string' ? req.query.ids.split(',') : undefined;
    const checks = ids
      ? allChecks.filter(check => ids.includes(check.id))
      : allChecks;
    res.setHeader('Content-Type', 'application/yaml');
    res.status(200).end(yaml.dump(checks));
  });

  router.post(
    '/checks/import',
    express.text({
      type: ['text/yaml', 'application/x-yaml', 'text/plain'],
      limit: '2mb',
    }),
    async (req, res) => {
      const credentials = await httpAuth.credentials(req, { allow: ['user'] });
      await authorize(permissions, credentials, soundcheckCheckWritePermission);
      const parsed = parseYamlBody(req);
      const entries = toDocumentArray(parsed, 'checks');
      const existing = new Set((await store.getChecks()).map(c => c.id));
      const created: SoundcheckCheck[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];
      for (const entry of entries) {
        try {
          assertValidCheck(entry);
        } catch (e) {
          skipped.push({
            id:
              typeof (entry as Record<string, unknown> | null)?.id === 'string'
                ? ((entry as Record<string, unknown>).id as string)
                : '(unknown)',
            reason: e instanceof Error ? e.message : String(e),
          });
          continue;
        }
        if (existing.has(entry.id)) {
          skipped.push({ id: entry.id, reason: 'duplicate id' });
          continue;
        }
        await store.upsertCheck(entry);
        existing.add(entry.id);
        created.push(entry);
      }
      logger.info(
        `Imported ${created.length} Soundcheck checks (${skipped.length} skipped)`,
      );
      await publishAudit(events, {
        action: 'soundcheck.check.import',
        actor: getUserRef(credentials),
        metadata: {
          created: created.map(c => c.id),
          skipped,
        },
      });
      res.status(created.length > 0 ? 201 : 200).json({ created, skipped });
    },
  );

  router.get('/checks/:id/insights', async (req, res) => {
    const { id } = req.params;
    const check = await store.getCheck(id);
    if (!check) {
      throw new NotFoundError(`Soundcheck check ${id} not found`);
    }
    const from =
      typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const results = await store.getCheckResultsForCheck(id, { from, to });
    res.json(buildCheckInsights(id, results));
  });

  router.get('/checks/:id/export', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const { id } = req.params;
    const check = await store.getCheck(id);
    if (!check) {
      throw new NotFoundError(`Soundcheck check ${id} not found`);
    }
    res.setHeader('Content-Type', 'application/yaml');
    res.status(200).end(yaml.dump(check));
  });

  router.get('/checks/:id/entities/csv', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const { id } = req.params;
    const check = await store.getCheck(id);
    if (!check) {
      throw new NotFoundError(`Soundcheck check ${id} not found`);
    }
    const status =
      typeof req.query.status === 'string'
        ? (req.query.status as SoundcheckCheckStatus)
        : undefined;
    const requestedLimit = Number(req.query.limit);
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_CSV_ROWS)
        : MAX_CSV_ROWS;
    const results = await store.getResultsForCheck(id, { status, limit });
    res.setHeader('Content-Type', 'text/csv');
    if (results.length >= MAX_CSV_ROWS) {
      res.setHeader('X-Soundcheck-Csv-Truncated', 'true');
    }
    res.status(200).end(resultsToCsv(results));
  });

  router.get('/tracks', async (_req, res) => {
    const tracks = await store.getTracks();
    res.json(tracks);
  });

  router.post('/tracks', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    await authorize(permissions, credentials, soundcheckTrackWritePermission);
    const track = req.body;
    assertValidTrack(track);
    await store.upsertTrack(track);
    logger.info(`Created/updated Soundcheck track '${track.id}'`);
    await publishAudit(events, {
      action: 'soundcheck.track.write',
      actor: getUserRef(credentials),
      entityRef: `soundcheck-track:${track.id}`,
      metadata: { name: track.name },
    });
    res.status(201).json(track);
  });

  router.get('/tracks/export', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const tracks = await store.getTracks();
    res.setHeader('Content-Type', 'application/yaml');
    res.status(200).end(yaml.dump(tracks));
  });

  router.post(
    '/tracks/import',
    express.text({
      type: ['text/yaml', 'application/x-yaml', 'text/plain'],
      limit: '2mb',
    }),
    async (req, res) => {
      const credentials = await httpAuth.credentials(req, { allow: ['user'] });
      await authorize(permissions, credentials, soundcheckTrackWritePermission);
      const parsed = parseYamlBody(req);
      const entries = toDocumentArray(parsed, 'tracks');
      const existing = new Set((await store.getTracks()).map(t => t.id));
      const created: SoundcheckTrack[] = [];
      const skipped: Array<{ id: string; reason: string }> = [];
      for (const entry of entries) {
        try {
          assertValidTrack(entry);
        } catch (e) {
          skipped.push({
            id:
              typeof (entry as Record<string, unknown> | null)?.id === 'string'
                ? ((entry as Record<string, unknown>).id as string)
                : '(unknown)',
            reason: e instanceof Error ? e.message : String(e),
          });
          continue;
        }
        if (existing.has(entry.id)) {
          skipped.push({ id: entry.id, reason: 'duplicate id' });
          continue;
        }
        await store.upsertTrack(entry);
        existing.add(entry.id);
        created.push(entry);
      }
      logger.info(
        `Imported ${created.length} Soundcheck tracks (${skipped.length} skipped)`,
      );
      await publishAudit(events, {
        action: 'soundcheck.track.import',
        actor: getUserRef(credentials),
        metadata: { created: created.map(t => t.id), skipped },
      });
      res.status(created.length > 0 ? 201 : 200).json({ created, skipped });
    },
  );

  router.get('/tracks/:id/insights', async (req, res) => {
    const { id } = req.params;
    const track = await store.getTrack(id);
    if (!track) {
      throw new NotFoundError(`Soundcheck track ${id} not found`);
    }
    const certifications = await store.getCertificationsForTrack(id);
    res.json(buildTrackInsights(id, track, certifications));
  });

  router.get('/campaigns', async (_req, res) => {
    const campaigns = await store.getCampaigns();
    res.json(campaigns);
  });

  router.post('/campaigns', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    await authorize(
      permissions,
      credentials,
      soundcheckCampaignWritePermission,
    );
    const campaign = req.body;
    assertValidCampaign(campaign);
    await store.upsertCampaign(campaign);
    logger.info(`Created/updated Soundcheck campaign '${campaign.id}'`);
    await publishAudit(events, {
      action: 'soundcheck.campaign.write',
      actor: getUserRef(credentials),
      entityRef: `soundcheck-campaign:${campaign.id}`,
      metadata: { name: campaign.name },
    });
    res.status(201).json(campaign);
  });

  router.get('/campaigns/export', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const campaigns = await store.getCampaigns();
    res.setHeader('Content-Type', 'application/yaml');
    res.status(200).end(yaml.dump(campaigns));
  });

  router.get('/campaigns/:id/insights', async (req, res) => {
    const { id } = req.params;
    const campaign = await store.getCampaign(id);
    if (!campaign) {
      throw new NotFoundError(`Soundcheck campaign ${id} not found`);
    }
    const track = await store.getTrack(campaign.trackId);
    if (!track) {
      throw new NotFoundError(
        `Soundcheck track ${campaign.trackId} not found for campaign ${id}`,
      );
    }
    const checkIds = Array.from(
      new Set(track.levels.flatMap(level => level.checks)),
    );
    const [certifications, results] = await Promise.all([
      store.getCertificationsForTrack(track.id),
      store.getCheckResultsForChecks(checkIds),
    ]);
    const totalCount = new Set(results.map(result => result.entityRef)).size;

    res.json({
      campaignId: id,
      milestones: buildCampaignMilestones({
        track,
        targetLevel: campaign.targetLevel,
        certifications,
        totalCount,
      }),
      passRateTrend: buildPassRateTrend(results),
      daysRemaining: daysRemaining(campaign.endDate),
    });
  });

  router.get('/entities/:entityRef/results', async (req, res) => {
    const entityRef = decodeURIComponent(req.params.entityRef);
    const results = await store.getCheckResults(entityRef);
    res.json(results);
  });

  router.get('/entities/:entityRef/facts', async (req, res) => {
    const entityRef = decodeURIComponent(req.params.entityRef);
    const facts = await store.getFacts(entityRef);
    res.json(facts);
  });

  router.get('/entities/:entityRef/certifications', async (req, res) => {
    const entityRef = decodeURIComponent(req.params.entityRef);
    const certs = await store.getCertifications(entityRef);
    res.json(certs);
  });

  router.post('/entities/:entityRef/evaluate', async (req, res) => {
    const credentials = await httpAuth.credentials(req, {
      allow: ['user'],
      allowLimitedAccess: true,
    });
    const entityRef = decodeURIComponent(req.params.entityRef);
    const facts = await store.getFacts(entityRef);
    const checks = await store.getChecks();

    const results = await Promise.all(
      checks.map(async (check): Promise<SoundcheckCheckResult> => {
        const exempt = await store.isExempt(check.id, entityRef);
        if (exempt) {
          return {
            checkId: check.id,
            entityRef,
            status: 'exempt',
            evaluatedAt: DateTime.now().toISO() as string,
          };
        }
        return engine.evaluate(check, entityRef, facts);
      }),
    );
    for (const result of results) {
      await store.upsertCheckResult(result);
    }

    logger.info(`Evaluated ${results.length} checks for ${entityRef}`);
    await publishAudit(events, {
      action: 'soundcheck.entity.evaluate',
      actor: getUserRef(credentials),
      entityRef,
      metadata: { checkCount: results.length },
    });
    res.json(results);
  });

  router.get('/exemptions', async (req, res) => {
    await httpAuth.credentials(req, {
      allow: ['user'],
      allowLimitedAccess: true,
    });
    const checkId =
      typeof req.query.checkId === 'string' ? req.query.checkId : undefined;
    const entityRef =
      typeof req.query.entityRef === 'string' ? req.query.entityRef : undefined;
    const exemptions = await store.listExemptions({ checkId, entityRef });
    res.json(exemptions);
  });

  router.post('/exemptions', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    await authorize(
      permissions,
      credentials,
      soundcheckExemptionWritePermission,
    );
    const { checkId, entityRef, reason } = req.body ?? {};
    if (typeof checkId !== 'string' || checkId.length === 0) {
      throw new InputError("'checkId' is required");
    }
    if (typeof entityRef !== 'string' || entityRef.length === 0) {
      throw new InputError("'entityRef' is required");
    }
    if (typeof reason !== 'string' || reason.length === 0) {
      throw new InputError("'reason' is required");
    }
    const exemption = await store.createExemption({
      checkId,
      entityRef,
      reason,
      grantedBy: getUserRef(credentials),
    });
    logger.info(
      `Granted exemption ${exemption.id} for ${entityRef} on check ${checkId}`,
    );
    await publishAudit(events, {
      action: 'soundcheck.exemption.grant',
      actor: getUserRef(credentials),
      entityRef,
      metadata: { exemptionId: exemption.id, checkId, reason },
    });
    res.status(201).json(exemption);
  });

  router.post('/exemptions/:id/revoke', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    await authorize(
      permissions,
      credentials,
      soundcheckExemptionWritePermission,
    );
    const { id } = req.params;
    await store.revokeExemption(id, getUserRef(credentials));
    logger.info(`Revoked exemption ${id}`);
    await publishAudit(events, {
      action: 'soundcheck.exemption.revoke',
      actor: getUserRef(credentials),
      metadata: { exemptionId: id },
    });
    res.status(204).end();
  });

  router.post('/exemptions/:id/restore', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    await authorize(
      permissions,
      credentials,
      soundcheckExemptionWritePermission,
    );
    const { id } = req.params;
    await store.restoreExemption(id);
    logger.info(`Restored exemption ${id}`);
    await publishAudit(events, {
      action: 'soundcheck.exemption.restore',
      actor: getUserRef(credentials),
      metadata: { exemptionId: id },
    });
    res.status(204).end();
  });

  return router;
}
