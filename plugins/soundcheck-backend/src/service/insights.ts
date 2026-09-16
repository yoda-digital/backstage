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
  SoundcheckCampaignMilestone,
  SoundcheckCertification,
  SoundcheckCheckInsights,
  SoundcheckCheckInsightsDistribution,
  SoundcheckCheckResult,
  SoundcheckCheckStatus,
  SoundcheckInsightsTrendPoint,
  SoundcheckTrack,
  SoundcheckTrackInsights,
} from '@backstage/plugin-soundcheck-common';

/**
 * Buckets a raw check status into one of the distribution keys shown in the
 * insights donut chart. `error` is folded into `warning`, matching how it
 * is presented elsewhere in the Soundcheck UI.
 *
 * @internal
 */
export function bucketCheckStatus(
  status: SoundcheckCheckStatus,
): keyof SoundcheckCheckInsightsDistribution {
  switch (status) {
    case 'pass':
      return 'pass';
    case 'fail':
      return 'fail';
    case 'error':
      return 'warning';
    case 'exempt':
      return 'exempt';
    default:
      return 'unknown';
  }
}

/** Mutable counterpart of {@link SoundcheckCheckInsightsDistribution}, used while accumulating counts. */
type MutableDistribution = {
  -readonly [K in keyof SoundcheckCheckInsightsDistribution]: number;
};

function emptyDistribution(): MutableDistribution {
  return { pass: 0, fail: 0, warning: 0, exempt: 0, unknown: 0 };
}

/**
 * Extracts the `YYYY-MM-DD` portion of an ISO timestamp, used to bucket
 * insights data points by day.
 *
 * @internal
 */
export function dayKey(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

/**
 * Builds the aggregate insights payload for `GET /checks/:id/insights` out
 * of the (optionally date-filtered) results for that check.
 *
 * @internal
 */
export function buildCheckInsights(
  checkId: string,
  results: SoundcheckCheckResult[],
): SoundcheckCheckInsights {
  const distribution = emptyDistribution();
  const trendByDay = new Map<string, MutableDistribution>();

  for (const result of results) {
    const bucket = bucketCheckStatus(result.status);
    distribution[bucket] += 1;

    const day = dayKey(result.evaluatedAt);
    const dayDistribution = trendByDay.get(day) ?? emptyDistribution();
    dayDistribution[bucket] += 1;
    trendByDay.set(day, dayDistribution);
  }

  const trend = Array.from(trendByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, values: { ...values } }));

  return { checkId, distribution, trend, entities: results };
}

/**
 * Builds the aggregate insights payload for `GET /tracks/:id/insights`:
 * how many entities currently hold each certification level, and a
 * cumulative adoption trend per level over time.
 *
 * @internal
 */
export function buildTrackInsights(
  trackId: string,
  track: SoundcheckTrack,
  certifications: SoundcheckCertification[],
): SoundcheckTrackInsights {
  const sortedLevels = [...track.levels].sort((a, b) => a.rank - b.rank);

  const levelDistribution = sortedLevels.map(level => ({
    levelName: level.name,
    levelRank: level.rank,
    count: certifications.filter(cert => cert.levelName === level.name).length,
  }));

  const certsByDay = new Map<string, SoundcheckCertification[]>();
  for (const cert of certifications) {
    const day = dayKey(cert.certifiedAt);
    const list = certsByDay.get(day) ?? [];
    list.push(cert);
    certsByDay.set(day, list);
  }

  const cumulative: Record<string, number> = {};
  for (const level of sortedLevels) {
    cumulative[level.name] = 0;
  }

  const trend: SoundcheckInsightsTrendPoint[] = Array.from(certsByDay.keys())
    .sort((a, b) => a.localeCompare(b))
    .map(day => {
      for (const cert of certsByDay.get(day) ?? []) {
        cumulative[cert.levelName] = (cumulative[cert.levelName] ?? 0) + 1;
      }
      return { date: day, values: { ...cumulative } };
    });

  return { trackId, levelDistribution, trend };
}

/**
 * Computes progress toward each track level up to (and including) a
 * campaign's target level. `totalCount` is the denominator used for every
 * milestone's percentage — typically the number of entities observed with
 * at least one result for the campaign's track.
 *
 * @internal
 */
export function buildCampaignMilestones(options: {
  track: SoundcheckTrack;
  targetLevel: string;
  certifications: SoundcheckCertification[];
  totalCount: number;
}): SoundcheckCampaignMilestone[] {
  const { track, targetLevel, certifications, totalCount } = options;
  const sortedLevels = [...track.levels].sort((a, b) => a.rank - b.rank);
  const targetRank =
    sortedLevels.find(level => level.name === targetLevel)?.rank ??
    sortedLevels[sortedLevels.length - 1]?.rank ??
    0;

  return sortedLevels
    .filter(level => level.rank <= targetRank)
    .map(level => {
      const certifiedCount = certifications.filter(
        cert => cert.levelRank >= level.rank,
      ).length;
      const percentage =
        totalCount === 0 ? 0 : (certifiedCount / totalCount) * 100;
      return {
        levelName: level.name,
        levelRank: level.rank,
        certifiedCount,
        totalCount,
        percentage,
      };
    });
}

/**
 * Builds a daily pass-rate trend (percentage of non-exempt results that
 * passed) out of check results across a campaign's track.
 *
 * @internal
 */
export function buildPassRateTrend(
  results: SoundcheckCheckResult[],
): SoundcheckInsightsTrendPoint[] {
  const byDay = new Map<string, { pass: number; total: number }>();

  for (const result of results) {
    if (result.status === 'exempt') {
      continue;
    }
    const day = dayKey(result.evaluatedAt);
    const bucket = byDay.get(day) ?? { pass: 0, total: 0 };
    bucket.total += 1;
    if (result.status === 'pass') {
      bucket.pass += 1;
    }
    byDay.set(day, bucket);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { pass, total }]) => ({
      date,
      values: {
        passRate: total === 0 ? 0 : Math.round((pass / total) * 1000) / 10,
      },
    }));
}

/**
 * Days remaining until `endDate`, negative when it has already passed.
 *
 * @internal
 */
export function daysRemaining(endDate: string, now: Date = new Date()): number {
  const diffMs = new Date(endDate).getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
