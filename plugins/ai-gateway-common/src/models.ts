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

import { AiModelCapabilities } from './types';

/** Well-known model capability presets, keyed by model id. */
export const MODEL_CAPABILITY_PRESETS: Record<string, AiModelCapabilities> = {
  'claude-sonnet-4-20250514': {
    chat: true,
    streaming: true,
    vision: true,
    toolUse: true,
    maxContextTokens: 200000,
    maxOutputTokens: 64000,
  },
  'gpt-4o': {
    chat: true,
    streaming: true,
    vision: true,
    toolUse: true,
    maxContextTokens: 128000,
    maxOutputTokens: 16384,
  },
};
