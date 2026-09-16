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
  EntityOverlay,
  OverlayApplyResult,
  OverlayPatch,
} from '@backstage/plugin-entity-overlays-common';

/**
 * API for reading and writing entity overlays.
 * @public
 */
export interface OverlayApi {
  /**
   * Lists all overlays known to the backend.
   */
  listOverlays(): Promise<EntityOverlay[]>;

  /**
   * Fetches the overlay for a given entity, or `undefined` if none exists.
   */
  getOverlay(entityRef: string): Promise<EntityOverlay | undefined>;

  /**
   * Replaces the overlay patches for a given entity.
   */
  setOverlay(
    entityRef: string,
    patches: OverlayPatch[],
  ): Promise<OverlayApplyResult>;

  /**
   * Deletes the overlay for a given entity.
   */
  deleteOverlay(entityRef: string): Promise<void>;
}

/**
 * API ref for the {@link OverlayApi}.
 * @public
 */
export const overlayApiRef = createApiRef<OverlayApi>({
  id: 'plugin.entity-overlays.service',
});
