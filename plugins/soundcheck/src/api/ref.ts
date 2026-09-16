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
  SoundcheckCampaign,
  SoundcheckCampaignInsights,
  SoundcheckCertification,
  SoundcheckCheck,
  SoundcheckCheckInsights,
  SoundcheckCheckResult,
  SoundcheckEntityFilter,
  SoundcheckFact,
  SoundcheckRuleOperator,
  SoundcheckTrack,
  SoundcheckTrackInsights,
} from '@backstage/plugin-soundcheck-common';

/**
 * A registered fact collector, as returned by the Soundcheck backend's
 * `GET /facts/collectors` endpoint. Used by the no-code check builder to
 * populate its fact reference dropdown.
 *
 * @public
 */
export interface SoundcheckFactCollector {
  readonly factRef: string;
  readonly description?: string;
  readonly sampleFields?: string[];
}

/**
 * The evaluated outcome of a single rule condition within a dry run,
 * showing the resolved fact value alongside the configured comparison.
 *
 * @public
 */
export interface SoundcheckDryRunConditionResult {
  readonly path?: string;
  readonly operator: SoundcheckRuleOperator;
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly passed: boolean;
}

/**
 * Result of dry-running a check definition against a single entity, without
 * persisting the check or its result.
 *
 * @public
 */
export interface SoundcheckDryRunResult {
  readonly status: 'pass' | 'fail' | 'error';
  readonly message?: string;
  readonly breakdown: SoundcheckDryRunConditionResult[];
}

/**
 * Result of exploring a fact's collected data for a single entity, used by
 * the {@link FactExplorer} to help authors discover paths for rule
 * conditions.
 *
 * @public
 */
export interface SoundcheckFactExploreResult {
  readonly fact?: SoundcheckFact;
  readonly resolvedValue?: unknown;
}

/**
 * An entry skipped during a YAML import, either because it failed
 * validation or because its `id` collided with an existing definition.
 *
 * @public
 */
export interface SoundcheckImportSkip {
  readonly id: string;
  readonly reason: string;
}

/**
 * Partial-failure report returned by a YAML import endpoint: the
 * definitions that were created, and the ones skipped along with why.
 *
 * @public
 */
export interface SoundcheckImportReport<T> {
  readonly created: T[];
  readonly skipped: SoundcheckImportSkip[];
}

/**
 * API surface for interacting with the Soundcheck backend.
 *
 * @public
 */
export interface SoundcheckApi {
  /** List all registered checks. */
  getChecks(): Promise<SoundcheckCheck[]>;

  /** List all registered tracks. */
  getTracks(): Promise<SoundcheckTrack[]>;

  /** List all registered campaigns. */
  getCampaigns(): Promise<SoundcheckCampaign[]>;

  /** Get the latest check results for an entity. */
  getEntityResults(entityRef: string): Promise<SoundcheckCheckResult[]>;

  /** Get the collected facts for an entity. */
  getEntityFacts(entityRef: string): Promise<SoundcheckFact[]>;

  /** Get the certifications earned by an entity. */
  getEntityCertifications(
    entityRef: string,
  ): Promise<SoundcheckCertification[]>;

  /** Trigger an evaluation of all checks for an entity. */
  evaluateEntity(entityRef: string): Promise<SoundcheckCheckResult[]>;

  /** Create or update a check definition. */
  saveCheck(
    check: SoundcheckCheck & { excludeFilter?: SoundcheckEntityFilter },
  ): Promise<SoundcheckCheck>;

  /** Evaluate a check definition against a single entity without persisting it. */
  dryRunCheck(
    check: SoundcheckCheck & { excludeFilter?: SoundcheckEntityFilter },
    entityRef: string,
  ): Promise<SoundcheckDryRunResult>;

  /** List every fact collector registered with the Soundcheck backend. */
  getFactCollectors(): Promise<SoundcheckFactCollector[]>;

  /** Fetch (and optionally resolve a path within) a fact's data for an entity. */
  exploreFact(
    factRef: string,
    entityRef: string,
    path?: string,
  ): Promise<SoundcheckFactExploreResult>;

  /** Create or update a track definition. */
  saveTrack(track: SoundcheckTrack): Promise<SoundcheckTrack>;

  /** Create or update a campaign definition. */
  saveCampaign(campaign: SoundcheckCampaign): Promise<SoundcheckCampaign>;

  /**
   * Import check definitions from a YAML document (either a bare array, or
   * an object with a `checks` array), skipping any whose `id` already
   * exists.
   */
  importChecks(yaml: string): Promise<SoundcheckImportReport<SoundcheckCheck>>;

  /**
   * Import track definitions from a YAML document (either a bare array, or
   * an object with a `tracks` array), skipping any whose `id` already
   * exists.
   */
  importTracks(yaml: string): Promise<SoundcheckImportReport<SoundcheckTrack>>;

  /** Export check definitions (all, or a given subset) as a YAML document. */
  exportChecks(ids?: string[]): Promise<string>;

  /** Export a single check definition as a YAML document. */
  exportCheck(checkId: string): Promise<string>;

  /** Export all track definitions as a YAML document. */
  exportTracks(): Promise<string>;

  /** Export all campaign definitions as a YAML document. */
  exportCampaigns(): Promise<string>;

  /** Export a check's evaluation results across entities as a CSV document. */
  exportChecksCsv(
    checkId: string,
    filters?: { status?: string; limit?: number },
  ): Promise<Blob>;

  /** Get aggregate pass/fail/warning/exempt insights for a check. */
  getCheckInsights(
    checkId: string,
    range?: { from?: string; to?: string },
  ): Promise<SoundcheckCheckInsights>;

  /** Get aggregate certification-level insights for a track. */
  getTrackInsights(trackId: string): Promise<SoundcheckTrackInsights>;

  /** Get aggregate milestone and pass-rate insights for a campaign. */
  getCampaignInsights(campaignId: string): Promise<SoundcheckCampaignInsights>;
}

/**
 * Utility API reference for the {@link SoundcheckApi}.
 *
 * @public
 */
export const soundcheckApiRef = createApiRef<SoundcheckApi>({
  id: 'plugin.soundcheck.api',
});
