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
 * Common types and utilities for the Soundcheck plugin.
 * @packageDocumentation
 */

export type {
  SoundcheckFact,
  SoundcheckCheck,
  SoundcheckPathResolver,
  SoundcheckRule,
  SoundcheckRuleCondition,
  SoundcheckRuleAll,
  SoundcheckRuleAny,
  SoundcheckRuleNot,
  SoundcheckBaseRuleOperator,
  SoundcheckRuleOperator,
  SoundcheckCheckResult,
  SoundcheckCheckStatus,
  SoundcheckTrack,
  SoundcheckLevel,
  SoundcheckBadge,
  SoundcheckCampaign,
  SoundcheckCertification,
  SoundcheckExemption,
  SoundcheckExemptionStatus,
  SoundcheckEntityFilter,
  SoundcheckInsightsTrendPoint,
  SoundcheckCheckInsightsDistribution,
  SoundcheckCheckInsights,
  SoundcheckTrackLevelDistribution,
  SoundcheckTrackInsights,
  SoundcheckCampaignMilestone,
  SoundcheckCampaignInsights,
} from './types';
export { matchesEntityFilter } from './filters';
export {
  SOUNDCHECK_PLUGIN_ID,
  SOUNDCHECK_FACT_LIFECYCLE_MAX_DAYS,
} from './constants';
export {
  soundcheckCheckWritePermission,
  soundcheckTrackWritePermission,
  soundcheckCampaignWritePermission,
  soundcheckExemptionWritePermission,
  soundcheckPermissions,
} from './permissions';
