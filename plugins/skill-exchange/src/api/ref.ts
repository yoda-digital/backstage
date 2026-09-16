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

import { createApiRef } from '@backstage/core-plugin-api';
import {
  CreateGigRequest,
  Gig,
  GigApplication,
  GigMatch,
  GigStatus,
  GigType,
  SkillProfile,
} from '@backstage/plugin-skill-exchange-common';

/**
 * Query parameters accepted by {@link SkillExchangeApi.listGigs}.
 *
 * @public
 */
export interface GigQuery {
  type?: GigType;
  status?: GigStatus;
  direction?: 'offer' | 'request';
  skills?: string[];
  createdBy?: string;
}

/**
 * API for interacting with the skill-exchange-backend REST API.
 *
 * @public
 */
export interface SkillExchangeApi {
  /** Lists gigs, optionally filtered by the given query. */
  listGigs(query?: GigQuery): Promise<Gig[]>;
  /** Fetches a single gig by id. */
  getGig(id: string): Promise<Gig>;
  /** Creates a new gig offer or request. */
  createGig(gig: CreateGigRequest): Promise<Gig>;
  /** Updates an existing gig. */
  updateGig(id: string, updates: Partial<Gig>): Promise<void>;
  /** Deletes a gig. */
  deleteGig(id: string): Promise<void>;
  /** Lists applications for a given gig, or all applications by the current user. */
  listApplications(gigId?: string): Promise<GigApplication[]>;
  /** Applies to an existing gig. */
  applyToGig(gigId: string, message?: string): Promise<GigApplication>;
  /** Accepts or rejects an application. */
  updateApplication(
    id: string,
    status: 'accepted' | 'rejected' | 'withdrawn',
  ): Promise<void>;
  /** Lists computed matches, optionally scoped to a single gig. */
  listMatches(gigId?: string): Promise<GigMatch[]>;
  /**
   * Lists the canonical set of known skills, merging YAML-configured
   * skills with skills already in use across gigs and profiles.
   */
  listSkills(): Promise<string[]>;
  /** Fetches the skill profile for the given user, defaulting to the current user. */
  getProfile(userRef?: string): Promise<SkillProfile>;
  /** Updates the skill profile for the current user. */
  updateProfile(profile: Partial<SkillProfile>): Promise<void>;
}

/**
 * {@link @backstage/core-plugin-api#ApiRef} for the {@link SkillExchangeApi}.
 *
 * @public
 */
export const skillExchangeApiRef = createApiRef<SkillExchangeApi>({
  id: 'plugin.skill-exchange.api',
});
