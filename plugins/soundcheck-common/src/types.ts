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
 * A fact collected from an external source about an entity.
 * @public
 */
export interface SoundcheckFact {
  readonly factRef: string;
  readonly entityRef: string;
  readonly data: Record<string, unknown>;
  readonly collectedAt: string;
  readonly expiresAt?: string;
}

/**
 * A check rule that evaluates facts and produces a pass/fail result.
 * @public
 */
export interface SoundcheckCheck {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly factRef: string;
  readonly rule: SoundcheckRule;
  readonly ownerEntityRef?: string;
  readonly filter?: SoundcheckEntityFilter;
  /**
   * The path resolver used to evaluate every {@link SoundcheckRuleCondition.path}
   * in this check's rule tree. Defaults to `jsonpath`.
   */
  readonly pathResolver?: SoundcheckPathResolver;
  /**
   * Liquid template rendered as the result message when the check passes.
   * See `messageRenderer.ts` in `@backstage/plugin-soundcheck-backend` for
   * the supported template context.
   */
  readonly passedMessage?: string;
  /**
   * Liquid template rendered as the result message when the check fails.
   */
  readonly failedMessage?: string;
}

/**
 * The path resolver implementation used to extract a value out of fact data
 * for a given {@link SoundcheckRuleCondition.path}.
 * @public
 */
export type SoundcheckPathResolver =
  | 'jsonpath'
  | 'lodash'
  | 'jmespath'
  | 'jsonata';

/**
 * A single leaf condition — resolves a value out of a fact and compares it
 * against `value` using `operator`.
 * @public
 */
export interface SoundcheckRuleCondition {
  /**
   * The fact to evaluate this condition against. Defaults to the owning
   * check's `factRef` when omitted, allowing multi-fact rule trees.
   */
  readonly factRef?: string;
  /**
   * The path used to resolve a value out of the fact's data, interpreted by
   * the check's {@link SoundcheckCheck.pathResolver}.
   */
  readonly path?: string;
  /**
   * @deprecated Use `path` instead. Retained for backwards compatibility with
   * the original dot-notation field resolver.
   */
  readonly field?: string;
  readonly operator: SoundcheckRuleOperator;
  readonly value?: unknown;
}

/**
 * Passes when every nested rule passes.
 * @public
 */
export interface SoundcheckRuleAll {
  readonly all: SoundcheckRule[];
}

/**
 * Passes when at least one nested rule passes.
 * @public
 */
export interface SoundcheckRuleAny {
  readonly any: SoundcheckRule[];
}

/**
 * Passes when the nested rule fails.
 * @public
 */
export interface SoundcheckRuleNot {
  readonly not: SoundcheckRule;
}

/**
 * Rule definition for a check — either a single condition or a nested
 * boolean combinator (`all`/`any`/`not`) of other rules.
 * @public
 */
export type SoundcheckRule =
  | SoundcheckRuleCondition
  | SoundcheckRuleAll
  | SoundcheckRuleAny
  | SoundcheckRuleNot;

/**
 * The base set of comparison operators a rule condition may use. Any of
 * these may also be prefixed with `all:`, `any:`, or `none:` (see
 * {@link SoundcheckRuleOperator}) to apply it across every element of an
 * array-valued fact.
 * @public
 */
export type SoundcheckBaseRuleOperator =
  | 'equal'
  | 'notEqual'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'contains'
  | 'notContains'
  | 'matches'
  | 'exists'
  | 'notExists'
  | 'semverGt'
  | 'semverGte'
  | 'semverLt'
  | 'semverLte'
  | 'semverEq'
  | 'semverNeq'
  | 'semverSatisfies'
  | 'semverGtr'
  | 'semverLtr'
  | 'after'
  | 'before'
  | 'in'
  | 'notIn'
  | 'doesNotContain'
  | 'hasLengthOf';

/**
 * @public
 */
export type SoundcheckRuleOperator =
  | SoundcheckBaseRuleOperator
  | `all:${SoundcheckBaseRuleOperator}`
  | `any:${SoundcheckBaseRuleOperator}`
  | `none:${SoundcheckBaseRuleOperator}`;

/**
 * Result of evaluating a check against an entity's facts.
 * @public
 */
export interface SoundcheckCheckResult {
  readonly checkId: string;
  readonly entityRef: string;
  readonly status: SoundcheckCheckStatus;
  readonly message?: string;
  readonly evaluatedAt: string;
}

/** @public */
export type SoundcheckCheckStatus =
  | 'pass'
  | 'fail'
  | 'unknown'
  | 'error'
  | 'exempt';

/**
 * A track groups checks in order and awards a certification level.
 * @public
 */
export interface SoundcheckTrack {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly ownerEntityRef?: string;
  readonly levels: SoundcheckLevel[];
  readonly filter?: SoundcheckEntityFilter;
}

/**
 * A certification level within a track. An entity earns the level
 * when all required checks pass.
 * @public
 */
export interface SoundcheckLevel {
  readonly name: string;
  readonly rank: number;
  readonly checks: string[];
  /**
   * Visual badge awarded alongside this level. When omitted, the UI falls
   * back to a default medal emoji keyed off {@link SoundcheckLevel.rank}.
   */
  readonly badge?: SoundcheckBadge;
}

/**
 * Visual representation of a {@link SoundcheckLevel}, rendered by
 * `BadgeDisplay` in `@backstage/plugin-soundcheck`. `svgContent` takes
 * precedence over `emoji` when both are present.
 * @public
 */
export interface SoundcheckBadge {
  /** Raw inline SVG markup rendered in place of the default emoji chip. */
  readonly svgContent?: string;
  /** Emoji shown in the badge chip, overriding the rank-based default. */
  readonly emoji?: string;
  /** Background color applied to the badge chip. */
  readonly color?: string;
}

/**
 * A time-bound campaign to drive entities through a track.
 * @public
 */
export interface SoundcheckCampaign {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly trackId: string;
  readonly targetLevel: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly targetFilter?: SoundcheckEntityFilter;
  readonly ownerEntityRef?: string;
}

/**
 * An entity's certification — the highest level achieved in a track.
 * @public
 */
export interface SoundcheckCertification {
  readonly entityRef: string;
  readonly trackId: string;
  readonly levelName: string;
  readonly levelRank: number;
  readonly certifiedAt: string;
}

/**
 * A grant that exempts an entity from a specific check. An exempt
 * entity/check pair reports a result status of `exempt` instead of
 * `pass`/`fail`.
 * @public
 */
export interface SoundcheckExemption {
  readonly id: string;
  readonly checkId: string;
  readonly entityRef: string;
  readonly reason: string;
  readonly grantedBy: string;
  readonly grantedAt: string;
  readonly revokedAt?: string;
  readonly revokedBy?: string;
  readonly status: SoundcheckExemptionStatus;
}

/** @public */
export type SoundcheckExemptionStatus = 'active' | 'revoked';

/**
 * Filter to select which entities a check/track/campaign applies to.
 * @public
 */
export interface SoundcheckEntityFilter {
  readonly kinds?: string[];
  readonly types?: string[];
  readonly lifecycles?: string[];
  readonly tags?: string[];
}

/**
 * A single point along an insights trend line, carrying a numeric value
 * per series (keyed by status, level name, or similar) for that date.
 * @public
 */
export interface SoundcheckInsightsTrendPoint {
  readonly date: string;
  readonly values: Record<string, number>;
}

/**
 * Distribution of the latest {@link SoundcheckCheckStatus} across all
 * entities evaluated against a check. `warning` aggregates the `error`
 * status, matching how it is presented in the Soundcheck UI.
 * @public
 */
export interface SoundcheckCheckInsightsDistribution {
  readonly pass: number;
  readonly fail: number;
  readonly warning: number;
  readonly exempt: number;
  readonly unknown: number;
}

/**
 * Aggregate insights for a single check, returned by
 * `GET /checks/:id/insights`.
 * @public
 */
export interface SoundcheckCheckInsights {
  readonly checkId: string;
  readonly distribution: SoundcheckCheckInsightsDistribution;
  readonly trend: SoundcheckInsightsTrendPoint[];
  readonly entities: SoundcheckCheckResult[];
}

/**
 * The number of entities certified at a given track level.
 * @public
 */
export interface SoundcheckTrackLevelDistribution {
  readonly levelName: string;
  readonly levelRank: number;
  readonly count: number;
}

/**
 * Aggregate insights for a single track, returned by
 * `GET /tracks/:id/insights`.
 * @public
 */
export interface SoundcheckTrackInsights {
  readonly trackId: string;
  readonly levelDistribution: SoundcheckTrackLevelDistribution[];
  readonly trend: SoundcheckInsightsTrendPoint[];
}

/**
 * Progress made towards a single milestone (track level) of a campaign.
 * `totalCount` is the number of entities observed with at least one check
 * result for the campaign's track, used as the denominator for
 * `percentage`.
 * @public
 */
export interface SoundcheckCampaignMilestone {
  readonly levelName: string;
  readonly levelRank: number;
  readonly certifiedCount: number;
  readonly totalCount: number;
  readonly percentage: number;
}

/**
 * Aggregate insights for a single campaign, returned by
 * `GET /campaigns/:id/insights`.
 * @public
 */
export interface SoundcheckCampaignInsights {
  readonly campaignId: string;
  readonly milestones: SoundcheckCampaignMilestone[];
  readonly passRateTrend: SoundcheckInsightsTrendPoint[];
  /**
   * Days remaining until the campaign's end date. Negative when the
   * campaign has already ended.
   */
  readonly daysRemaining: number;
}
