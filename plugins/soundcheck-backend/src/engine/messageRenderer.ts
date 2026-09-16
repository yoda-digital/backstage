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

import { Entity } from '@backstage/catalog-model';
import { Liquid } from 'liquidjs';

/**
 * The context a Soundcheck check's `passedMessage`/`failedMessage` Liquid
 * template is rendered with.
 *
 * @public
 */
export interface MessageRenderContext {
  /** The catalog entity the check was evaluated against, if available. */
  entity?: Entity;
  /** The data of the check's primary fact (`SoundcheckCheck.factRef`). */
  fact?: unknown;
  /** All fact data referenced by the check's rule, keyed by fact ref. */
  facts?: Record<string, unknown>;
}

const liquid = new Liquid();

// `{{ fact | json: 4 }}` — pretty-prints a value as JSON with the given
// indentation (defaults to no indentation).
liquid.registerFilter('json', (value: unknown, indent?: number) =>
  JSON.stringify(value, undefined, indent),
);

/**
 * Renders a Soundcheck message template (used for `passedMessage` and
 * `failedMessage`) with the given entity/fact context using Liquid.
 *
 * Supports, for example:
 * - `{{ entity.metadata.name }}`
 * - `{{ fact.someField }}`
 * - `{{ facts['other:default/fact'].someField }}`
 * - `{{ fact | json: 4 }}`
 *
 * @public
 */
export async function renderMessage(
  template: string,
  context: MessageRenderContext,
): Promise<string> {
  return liquid.parseAndRender(template, context);
}
