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
 * A patch operation to apply to an entity.
 *
 * `path` supports the following forms:
 * - `metadata.annotations.<key>` — set or remove a single annotation
 * - `metadata.labels.<key>` — set or remove a single label
 * - `metadata.tags` — append to (`add`), remove a value from (`remove`), or
 *   replace (`replace`) the entity's `metadata.tags` array; `value` is a
 *   single tag string for `add`/`remove`, or a `string[]` for `replace`
 * - `spec.lifecycle` — set (`add`/`replace`) or clear (`remove`) the
 *   entity's `spec.lifecycle`; `value` is a lifecycle string
 *
 * @public
 */
export interface OverlayPatch {
  readonly path: string;
  readonly op: 'add' | 'replace' | 'remove';
  readonly value?: unknown;
}

/**
 * An overlay containing patches for a specific entity.
 * @public
 */
export interface EntityOverlay {
  readonly entityRef: string;
  readonly patches: OverlayPatch[];
  readonly updatedBy: string;
  readonly updatedAt: string;
}

/**
 * Result of applying overlay patches to an entity.
 * @public
 */
export interface OverlayApplyResult {
  readonly entityRef: string;
  readonly patchesApplied: number;
}
