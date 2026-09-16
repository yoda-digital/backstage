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

import { createPermission } from '@backstage/plugin-permission-common';

/** Permission required to create, update, or import Soundcheck checks. */
export const soundcheckCheckWritePermission = createPermission({
  name: 'soundcheck.check.write',
  attributes: { action: 'update' },
});

/** Permission required to create, update, or import Soundcheck tracks. */
export const soundcheckTrackWritePermission = createPermission({
  name: 'soundcheck.track.write',
  attributes: { action: 'update' },
});

/** Permission required to create or update Soundcheck campaigns. */
export const soundcheckCampaignWritePermission = createPermission({
  name: 'soundcheck.campaign.write',
  attributes: { action: 'update' },
});

/** Permission required to grant, revoke, or restore Soundcheck exemptions. */
export const soundcheckExemptionWritePermission = createPermission({
  name: 'soundcheck.exemption.write',
  attributes: { action: 'update' },
});

/** All permissions defined by the Soundcheck plugin. */
export const soundcheckPermissions = [
  soundcheckCheckWritePermission,
  soundcheckTrackWritePermission,
  soundcheckCampaignWritePermission,
  soundcheckExemptionWritePermission,
];
