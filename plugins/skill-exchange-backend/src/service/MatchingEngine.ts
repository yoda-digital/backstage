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

import { Gig, GigMatch } from '@backstage/plugin-skill-exchange-common';

/**
 * Matches offer and request gigs against each other based on skill overlap.
 *
 * @internal
 */
export class MatchingEngine {
  findMatches(gig: Gig, candidates: Gig[]): GigMatch[] {
    const matches: GigMatch[] = [];
    const oppositeDirection = gig.direction === 'offer' ? 'request' : 'offer';

    for (const candidate of candidates) {
      if (candidate.direction !== oppositeDirection) continue;
      if (candidate.type !== gig.type) continue;
      if (candidate.status !== 'open') continue;
      if (candidate.createdBy === gig.createdBy) continue;

      const gigSkills = new Set(gig.skills.map(s => s.toLowerCase()));
      const matchedSkills = candidate.skills.filter(s =>
        gigSkills.has(s.toLowerCase()),
      );

      if (matchedSkills.length === 0) continue;

      const score =
        matchedSkills.length /
        Math.max(gig.skills.length, candidate.skills.length);

      matches.push({
        offerId: gig.direction === 'offer' ? gig.id : candidate.id,
        requestId: gig.direction === 'request' ? gig.id : candidate.id,
        score,
        matchedSkills,
        matchedAt: new Date().toISOString(),
      });
    }

    return matches.sort((a, b) => b.score - a.score);
  }
}
