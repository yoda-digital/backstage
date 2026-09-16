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

import type { SoundcheckEntityFilter } from './types';

/**
 * Checks whether an entity matches a Soundcheck entity filter.
 * @public
 */
export function matchesEntityFilter(
  entity: {
    kind: string;
    spec?: { type?: string; lifecycle?: string };
    metadata?: { tags?: string[] };
  },
  filter?: SoundcheckEntityFilter,
): boolean {
  if (!filter) return true;
  if (filter.kinds?.length && !filter.kinds.includes(entity.kind.toLowerCase()))
    return false;
  if (
    filter.types?.length &&
    !filter.types.includes(String(entity.spec?.type ?? ''))
  )
    return false;
  if (
    filter.lifecycles?.length &&
    !filter.lifecycles.includes(String(entity.spec?.lifecycle ?? ''))
  )
    return false;
  if (filter.tags?.length) {
    const entityTags = entity.metadata?.tags ?? [];
    if (!filter.tags.some(t => entityTags.includes(t))) return false;
  }
  return true;
}
