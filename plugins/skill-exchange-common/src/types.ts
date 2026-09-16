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

/**
 * The kind of internal gig being offered or requested.
 *
 * @public
 */
export type GigType = 'mentor' | 'pair' | 'hack' | 'embed';

/**
 * The lifecycle status of a {@link Gig}.
 *
 * @public
 */
export type GigStatus =
  | 'open'
  | 'matched'
  | 'active'
  | 'completed'
  | 'cancelled';

/**
 * A single gig, either an offer or a request for skill exchange, such as
 * mentoring, pairing, hackathons, or team embeds.
 *
 * @public
 */
export interface Gig {
  readonly id: string;
  readonly type: GigType;
  readonly title: string;
  readonly description: string;
  readonly skills: string[];
  readonly direction: 'offer' | 'request';
  readonly createdBy: string;
  readonly status: GigStatus;
  readonly matchedWith?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly createdAt: string;
}

/**
 * The payload used to create a new {@link Gig}.
 *
 * @public
 */
export interface CreateGigRequest {
  readonly type: GigType;
  readonly title: string;
  readonly description: string;
  readonly skills: string[];
  readonly direction: 'offer' | 'request';
  readonly startDate?: string;
  readonly endDate?: string;
}

/**
 * An application from a user expressing interest in an existing {@link Gig}.
 *
 * @public
 */
export interface GigApplication {
  readonly id: string;
  readonly gigId: string;
  readonly applicantRef: string;
  readonly message?: string;
  readonly status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  readonly createdAt: string;
}

/**
 * A computed match between an offer gig and a request gig.
 *
 * @public
 */
export interface GigMatch {
  readonly offerId: string;
  readonly requestId: string;
  readonly score: number;
  readonly matchedSkills: string[];
  readonly matchedAt: string;
}

/**
 * A user's declared skills, interests, and availability for gigs.
 *
 * @public
 */
export interface SkillProfile {
  readonly userRef: string;
  readonly skills: Array<{
    name: string;
    level: 'beginner' | 'intermediate' | 'expert';
  }>;
  readonly interests: string[];
  readonly availability: 'full' | 'partial' | 'none';
}
