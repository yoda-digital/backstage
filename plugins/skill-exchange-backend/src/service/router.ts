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
import { Config } from '@backstage/config';
import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';
import { InputError, NotAllowedError, NotFoundError } from '@backstage/errors';
import { NotificationService } from '@backstage/plugin-notifications-node';
import type { EventsService } from '@backstage/plugin-events-node';
import {
  CreateGigRequest,
  GigStatus,
  GigType,
  SkillProfile,
} from '@backstage/plugin-skill-exchange-common';
import { GigStore } from '../database/GigStore';
import { MatchingEngine } from './MatchingEngine';

/** @internal */
export interface RouterOptions {
  store: GigStore;
  matcher: MatchingEngine;
  httpAuth: HttpAuthService;
  logger: LoggerService;
  config: Config;
  notifications: NotificationService;
  /** Canonical skills declared via `skillExchange.skills` config. */
  configuredSkills: string[];
  events: EventsService;
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

/**
 * Publishes an audit event to the `audit` topic for the skill-exchange
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
      pluginId: 'skill-exchange',
      timestamp: new Date().toISOString(),
    },
  });
}

/** @internal */
export function createRouter(options: RouterOptions) {
  const {
    store,
    matcher,
    httpAuth,
    logger,
    config,
    notifications,
    configuredSkills,
    events,
  } = options;
  const router = Router();
  router.use(express.json());

  router.post('/gigs', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const createdBy = getUserRef(credentials);

    const body = req.body as Partial<CreateGigRequest>;
    if (
      !body.title ||
      !body.type ||
      !body.direction ||
      !Array.isArray(body.skills)
    ) {
      throw new InputError(
        'title, type, direction, and skills are required to create a gig',
      );
    }

    const gig = await store.createGig(
      {
        type: body.type,
        title: body.title,
        description: body.description ?? '',
        skills: body.skills,
        direction: body.direction,
        startDate: body.startDate,
        endDate: body.endDate,
      },
      createdBy,
    );

    const candidates = await store.listGigs({ status: 'open' });
    const matches = matcher.findMatches(gig, candidates);

    if (matches.length > 0) {
      await store.saveMatches(matches);

      const best = matches[0];
      const counterpartId =
        gig.direction === 'offer' ? best.requestId : best.offerId;
      const counterpart = await store.getGig(counterpartId);

      if (counterpart) {
        try {
          await notifications.send({
            recipients: {
              type: 'entity',
              entityRef: [gig.createdBy, counterpart.createdBy],
            },
            payload: {
              title: `New skill exchange match for "${gig.title}"`,
              description: `"${gig.title}" matched with "${
                counterpart.title
              }" (${Math.round(best.score * 100)}% skill overlap)`,
              severity: 'normal',
              topic: 'skill-exchange',
            },
          });
        } catch (error) {
          logger.warn(
            `Failed to send skill exchange match notification: ${error}`,
          );
        }
      }
    }

    await notifyInterestedProfiles(gig);

    logger.info(`Created gig ${gig.id} with ${matches.length} match(es)`);
    await publishAudit(events, {
      action: 'skill-exchange.gig.create',
      actor: createdBy,
      entityRef: gig.id,
    });
    res.status(201).json({ gig, matches });
  });

  async function notifyInterestedProfiles(gig: {
    id: string;
    title: string;
    type: GigType;
    skills: string[];
    createdBy: string;
  }): Promise<void> {
    const profiles = await store.listProfiles();
    const gigSkills = new Set(gig.skills.map(s => s.toLowerCase()));
    const interested = profiles.filter(profile => {
      if (profile.userRef === gig.createdBy) {
        return false;
      }
      const hasSkillOverlap = profile.skills.some(skill =>
        gigSkills.has(skill.name.toLowerCase()),
      );
      const hasInterestOverlap = profile.interests.some(interest =>
        gigSkills.has(interest.toLowerCase()),
      );
      return hasSkillOverlap || hasInterestOverlap;
    });

    if (interested.length === 0) {
      return;
    }

    try {
      await notifications.send({
        recipients: {
          type: 'entity',
          entityRef: interested.map(profile => profile.userRef),
        },
        payload: {
          title: `New ${gig.type} gig matches your skills`,
          description: `"${gig.title}" was just posted and overlaps with your declared skills or interests.`,
          severity: 'low',
          topic: 'skill-exchange',
        },
      });
    } catch (error) {
      logger.warn(`Failed to send new-gig-match notification: ${error}`);
    }
  }

  router.get('/gigs', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });

    const { type, direction, status, skills } = req.query;
    const gigs = await store.listGigs({
      type: typeof type === 'string' ? (type as GigType) : undefined,
      direction:
        direction === 'offer' || direction === 'request'
          ? direction
          : undefined,
      status: typeof status === 'string' ? (status as GigStatus) : undefined,
      skills: typeof skills === 'string' ? skills.split(',') : undefined,
    });

    res.json(gigs);
  });

  router.get('/gigs/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const gig = await store.getGig(req.params.id);
    if (!gig) {
      throw new NotFoundError(`No gig found with id ${req.params.id}`);
    }
    res.json(gig);
  });

  router.put('/gigs/:id/status', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const actor = getUserRef(credentials);
    const { status, matchedWith } = req.body as {
      status?: GigStatus;
      matchedWith?: string;
    };
    if (!status) {
      throw new InputError('status is required');
    }

    const gig = await store.updateGigStatus(req.params.id, status, matchedWith);
    if (!gig) {
      throw new NotFoundError(`No gig found with id ${req.params.id}`);
    }

    await publishAudit(events, {
      action: 'skill-exchange.gig.status.update',
      actor,
      entityRef: req.params.id,
    });
    res.status(200).json(gig);
  });

  router.get('/matches/:gigId', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const matches = await store.getMatchesForGig(req.params.gigId);
    res.json(matches);
  });

  router.get('/matches', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const gigId = asOptionalString(req.query.gigId);
    const matches = gigId
      ? await store.getMatchesForGig(gigId)
      : await store.listAllMatches();
    res.json(matches);
  });

  router.get('/skills', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const dbSkills = await store.listDistinctSkills();
    const merged = Array.from(new Set([...configuredSkills, ...dbSkills])).sort(
      (a, b) => a.localeCompare(b),
    );
    res.json(merged);
  });

  router.post('/applications', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const applicantRef = getUserRef(credentials);
    const { gigId, message } = req.body as {
      gigId?: string;
      message?: string;
    };
    if (!gigId) {
      throw new InputError('gigId is required');
    }
    const gig = await store.getGig(gigId);
    if (!gig) {
      throw new NotFoundError(`No gig found with id ${gigId}`);
    }

    const application = await store.createApplication(
      gigId,
      applicantRef,
      message,
    );

    try {
      await notifications.send({
        recipients: { type: 'entity', entityRef: [gig.createdBy] },
        payload: {
          title: `New application for "${gig.title}"`,
          description: `${applicantRef} applied to your gig "${gig.title}"${
            message ? `: ${message}` : ''
          }`,
          severity: 'normal',
          topic: 'skill-exchange',
        },
      });
    } catch (error) {
      logger.warn(`Failed to send application-received notification: ${error}`);
    }

    logger.info(`Created application ${application.id} for gig ${gigId}`);
    await publishAudit(events, {
      action: 'skill-exchange.application.create',
      actor: applicantRef,
      entityRef: application.id,
      severity: 'low',
    });
    res.status(201).json(application);
  });

  router.get('/applications', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const gigId = asOptionalString(req.query.gigId);
    const applications = await store.listApplications({ gigId });
    res.json(applications);
  });

  router.put('/applications/:id', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const actor = getUserRef(credentials);
    const { status } = req.body as {
      status?: 'accepted' | 'rejected' | 'withdrawn';
    };
    if (!status) {
      throw new InputError('status is required');
    }
    const application = await store.updateApplicationStatus(
      req.params.id,
      status,
    );
    await publishAudit(events, {
      action: 'skill-exchange.application.status.update',
      actor,
      entityRef: req.params.id,
    });
    res.status(200).json(application);
  });

  router.get('/profile', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const userRef = getUserRef(credentials);
    const profile = await store.getProfile(userRef);
    res.json(
      profile ?? {
        userRef,
        skills: [],
        interests: [],
        availability: 'partial',
      },
    );
  });

  router.put('/profile', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const userRef = getUserRef(credentials);
    const { skills, interests, availability } =
      req.body as Partial<SkillProfile>;

    const profile: SkillProfile = {
      userRef,
      skills: skills ?? [],
      interests: interests ?? [],
      availability: availability ?? 'partial',
    };

    await store.setProfile(profile);
    await publishAudit(events, {
      action: 'skill-exchange.profile.update',
      actor: userRef,
      entityRef: userRef,
      severity: 'low',
    });
    res.status(200).json(profile);
  });

  const middleware = MiddlewareFactory.create({ config, logger });
  router.use(middleware.error());
  return router;
}
