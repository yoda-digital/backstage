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
 * Translation strings for the Soundcheck plugin's UI.
 *
 * @public
 */
export const soundcheckTranslationRef = createTranslationRef({
  id: 'soundcheck',
  messages: {
    page: {
      tabChecks: 'Checks',
      tabTracks: 'Tracks',
      tabCampaigns: 'Campaigns',
      tabTemplates: 'Templates',
      createCheckButton: 'Create check',
      startFromTemplateButton: 'Start from template',
      importButton: 'Import',
    },
    entityCard: {
      title: 'Soundcheck',
      titleWithScore: 'Soundcheck ({{passed}}/{{total}})',
      noResults: 'No checks have been evaluated yet.',
      certificationsLabel: 'Certifications',
    },
    checkTemplates: {
      title: 'Check templates',
      subtitle:
        'Start from a pre-built set of checks instead of writing them by hand.',
      checksCount_one: '{{count}} check',
      checksCount_other: '{{count}} checks',
      useTemplateButton: 'Use template',
      customizeButton: 'Customize in builder',
      importSucceeded:
        'Created {{created}} check(s) from "{{name}}" ({{skipped}} already existed)',
      importFailed: 'Failed to import template "{{name}}": {{error}}',
    },
    importDialog: {
      titleChecks: 'Import checks',
      titleTracks: 'Import tracks',
      selectFileButton: 'Select YAML file',
      noFileSelected: 'No file selected',
      validateButton: 'Validate',
      importButton: 'Import',
      cancelButton: 'Cancel',
      closeButton: 'Close',
      parseError: 'Could not parse YAML: {{error}}',
      entriesFound_one: '{{count}} entry found',
      entriesFound_other: '{{count}} entries found',
      duplicateWarning_one: '{{count}} id already exists and will be skipped',
      duplicateWarning_other: '{{count}} ids already exist and will be skipped',
      resultSummary: '{{created}} created, {{skipped}} skipped',
    },
  },
});
