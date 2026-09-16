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
 * Frontend plugin for Soundcheck — quality and compliance scorecards for
 * catalog entities.
 *
 * @packageDocumentation
 */

export { default } from './alpha';
export type { SoundcheckApi } from './api/ref';
export { soundcheckApiRef } from './api/ref';
export { SoundcheckClient } from './api/SoundcheckClient';
export type { SoundcheckClientOptions } from './api/SoundcheckClient';
export { EntitySoundcheckCard } from './components/EntitySoundcheckCard';
export { SoundcheckPage } from './components/SoundcheckPage';
export { BadgeDisplay } from './components/BadgeDisplay';
export type { BadgeDisplayProps } from './components/BadgeDisplay';
export {
  CheckTemplates,
  BUILT_IN_CHECK_TEMPLATES,
} from './components/CheckTemplates';
export type {
  CheckTemplate,
  CheckTemplatesProps,
} from './components/CheckTemplates';
export { ImportDialog } from './components/ImportDialog';
export type {
  ImportDialogKind,
  ImportDialogProps,
} from './components/ImportDialog';
export { soundcheckTranslationRef } from './translation';
