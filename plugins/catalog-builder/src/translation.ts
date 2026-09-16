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
 * Translation strings for the Catalog Builder plugin's UI.
 *
 * @public
 */
export const catalogBuilderTranslationRef = createTranslationRef({
  id: 'catalog-builder',
  messages: {
    wizard: {
      title: 'Catalog Builder',
      subtitle: 'Bulk-import repositories into the catalog',
      heading: 'Ingestion Wizard',
      stepProvider: 'Provider',
      stepMode: 'Mode',
      stepOrganization: 'Organization',
      stepRepositories: 'Repositories',
      stepDetails: 'Details',
      stepReviewAndIngest: 'Review & Ingest',
    },
  },
});
