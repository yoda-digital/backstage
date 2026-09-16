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

import { createTranslationRef } from '@backstage/frontend-plugin-api';

/**
 * Translation strings for the Entity Overlays plugin's UI.
 *
 * @public
 */
export const entityOverlaysTranslationRef = createTranslationRef({
  id: 'entity-overlays',
  messages: {
    editor: {
      tagsTitle: 'Tags',
      lifecycleTitle: 'Lifecycle',
      currentPatchesTitle: 'Current overlay patches',
      addPatchTitle: 'Add or update an overlay patch',
      noPatchesTitle: 'No overlay patches',
      noPatchesDescription:
        'This entity has no overlay patches configured. Add one below.',
      saveButton: 'Save overlay',
      deleteAllButton: 'Delete all overlay patches',
      footerNote:
        'Overlay patches are applied on top of the entity as ingested from its source location, and are not persisted back to source control.',
    },
  },
});
