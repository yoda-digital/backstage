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

import {
  SoundcheckCertification,
  SoundcheckCheckResult,
  SoundcheckTrack,
} from '@backstage/plugin-soundcheck-common';
import {
  buildCampaignMilestones,
  buildCheckInsights,
  buildPassRateTrend,
  buildTrackInsights,
  bucketCheckStatus,
  daysRemaining,
  dayKey,
} from './insights';

describe('bucketCheckStatus', () => {
  it('folds error into warning and leaves the rest as-is', () => {
    expect(bucketCheckStatus('pass')).toEqual('pass');
    expect(bucketCheckStatus('fail')).toEqual('fail');
    expect(bucketCheckStatus('error')).toEqual('warning');
    expect(bucketCheckStatus('exempt')).toEqual('exempt');
    expect(bucketCheckStatus('unknown')).toEqual('unknown');
  });
});

describe('dayKey', () => {
  it('extracts the date portion of an ISO timestamp', () => {
    expect(dayKey('2026-01-02T03:04:05.000Z')).toEqual('2026-01-02');
  });
});

describe('buildCheckInsights', () => {
  const results: SoundcheckCheckResult[] = [
    {
      checkId: 'readme-exists',
      entityRef: 'component:default/a',
      status: 'pass',
      evaluatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      checkId: 'readme-exists',
      entityRef: 'component:default/b',
      status: 'fail',
      evaluatedAt: '2026-01-01T12:00:00.000Z',
    },
    {
      checkId: 'readme-exists',
      entityRef: 'component:default/c',
      status: 'error',
      evaluatedAt: '2026-01-02T00:00:00.000Z',
    },
    {
      checkId: 'readme-exists',
      entityRef: 'component:default/d',
      status: 'exempt',
      evaluatedAt: '2026-01-02T00:00:00.000Z',
    },
  ];

  it('computes the current distribution and a daily trend', () => {
    const insights = buildCheckInsights('readme-exists', results);

    expect(insights.checkId).toEqual('readme-exists');
    expect(insights.distribution).toEqual({
      pass: 1,
      fail: 1,
      warning: 1,
      exempt: 1,
      unknown: 0,
    });
    expect(insights.trend).toEqual([
      {
        date: '2026-01-01',
        values: { pass: 1, fail: 1, warning: 0, exempt: 0, unknown: 0 },
      },
      {
        date: '2026-01-02',
        values: { pass: 0, fail: 0, warning: 1, exempt: 1, unknown: 0 },
      },
    ]);
    expect(insights.entities).toBe(results);
  });
});

describe('buildTrackInsights', () => {
  const track: SoundcheckTrack = {
    id: 'production-readiness',
    name: 'Production readiness',
    description: '...',
    levels: [
      { name: 'Bronze', rank: 1, checks: [] },
      { name: 'Silver', rank: 2, checks: [] },
    ],
  };

  const certifications: SoundcheckCertification[] = [
    {
      entityRef: 'component:default/a',
      trackId: track.id,
      levelName: 'Bronze',
      levelRank: 1,
      certifiedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      entityRef: 'component:default/b',
      trackId: track.id,
      levelName: 'Bronze',
      levelRank: 1,
      certifiedAt: '2026-01-02T00:00:00.000Z',
    },
    {
      entityRef: 'component:default/a',
      trackId: track.id,
      levelName: 'Silver',
      levelRank: 2,
      certifiedAt: '2026-01-03T00:00:00.000Z',
    },
  ];

  it('counts certifications per level and builds a cumulative trend', () => {
    const insights = buildTrackInsights(track.id, track, certifications);

    expect(insights.levelDistribution).toEqual([
      { levelName: 'Bronze', levelRank: 1, count: 2 },
      { levelName: 'Silver', levelRank: 2, count: 1 },
    ]);
    expect(insights.trend).toEqual([
      { date: '2026-01-01', values: { Bronze: 1, Silver: 0 } },
      { date: '2026-01-02', values: { Bronze: 2, Silver: 0 } },
      { date: '2026-01-03', values: { Bronze: 2, Silver: 1 } },
    ]);
  });
});

describe('buildCampaignMilestones', () => {
  const track: SoundcheckTrack = {
    id: 'production-readiness',
    name: 'Production readiness',
    description: '...',
    levels: [
      { name: 'Bronze', rank: 1, checks: [] },
      { name: 'Silver', rank: 2, checks: [] },
      { name: 'Gold', rank: 3, checks: [] },
    ],
  };

  it('only includes levels up to the target, using cumulative certification counts', () => {
    const certifications: SoundcheckCertification[] = [
      {
        entityRef: 'component:default/a',
        trackId: track.id,
        levelName: 'Silver',
        levelRank: 2,
        certifiedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const milestones = buildCampaignMilestones({
      track,
      targetLevel: 'Silver',
      certifications,
      totalCount: 4,
    });

    expect(milestones).toEqual([
      {
        levelName: 'Bronze',
        levelRank: 1,
        certifiedCount: 1,
        totalCount: 4,
        percentage: 25,
      },
      {
        levelName: 'Silver',
        levelRank: 2,
        certifiedCount: 1,
        totalCount: 4,
        percentage: 25,
      },
    ]);
  });

  it('returns 0% milestones when nobody has been observed yet', () => {
    const milestones = buildCampaignMilestones({
      track,
      targetLevel: 'Bronze',
      certifications: [],
      totalCount: 0,
    });
    expect(milestones).toEqual([
      {
        levelName: 'Bronze',
        levelRank: 1,
        certifiedCount: 0,
        totalCount: 0,
        percentage: 0,
      },
    ]);
  });
});

describe('buildPassRateTrend', () => {
  it('excludes exempt results and computes a daily pass percentage', () => {
    const results: SoundcheckCheckResult[] = [
      {
        checkId: 'a',
        entityRef: 'component:default/1',
        status: 'pass',
        evaluatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        checkId: 'a',
        entityRef: 'component:default/2',
        status: 'fail',
        evaluatedAt: '2026-01-01T01:00:00.000Z',
      },
      {
        checkId: 'a',
        entityRef: 'component:default/3',
        status: 'exempt',
        evaluatedAt: '2026-01-01T02:00:00.000Z',
      },
    ];

    expect(buildPassRateTrend(results)).toEqual([
      { date: '2026-01-01', values: { passRate: 50 } },
    ]);
  });
});

describe('daysRemaining', () => {
  it('is positive before the end date and negative after it', () => {
    const now = new Date('2026-01-10T00:00:00.000Z');
    expect(daysRemaining('2026-01-15T00:00:00.000Z', now)).toEqual(5);
    expect(daysRemaining('2026-01-05T00:00:00.000Z', now)).toEqual(-5);
  });
});
