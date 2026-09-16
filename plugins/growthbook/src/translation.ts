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
 * Translation strings for the GrowthBook plugin's UI.
 *
 * @public
 */
export const growthbookTranslationRef = createTranslationRef({
  id: 'growthbook',
  messages: {
    featuresPage: {
      title: 'GrowthBook',
      subtitle: 'Feature flag management',
      searchLabel: 'Search',
      tagsLabel: 'Tags',
      tagsPlaceholder: 'Filter by tag',
      tableTitle: 'Features',
    },
    experimentsPage: {
      title: 'GrowthBook',
      subtitle: 'Experiments',
      tableTitle: 'Experiments',
    },
  },
});
