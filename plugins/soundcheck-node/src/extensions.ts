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

import { createExtensionPoint } from '@backstage/backend-plugin-api';
import type { SoundcheckFact } from '@backstage/plugin-soundcheck-common';

/**
 * A fact collector gathers data from an external source about catalog entities.
 * @public
 */
export interface SoundcheckFactCollector {
  readonly factRef: string;
  readonly description: string;
  collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>>;
}

/**
 * Extension point for registering fact collectors.
 * Backend modules use this to add new fact collection capabilities.
 * @public
 */
export interface SoundcheckFactCollectorExtensionPoint {
  addCollector(collector: SoundcheckFactCollector): void;
}

/** @public */
export const soundcheckFactCollectorExtensionPoint =
  createExtensionPoint<SoundcheckFactCollectorExtensionPoint>({
    id: 'soundcheck.fact-collectors',
  });

/**
 * A check provider supplies check definitions programmatically.
 * @public
 */
export interface SoundcheckCheckProvider {
  readonly providerId: string;
  getChecks(): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      factRef: string;
      rule: { operator: string; field: string; value: unknown };
    }>
  >;
}

/**
 * Extension point for registering custom check providers.
 * @public
 */
export interface SoundcheckCheckProviderExtensionPoint {
  addProvider(provider: SoundcheckCheckProvider): void;
}

/** @public */
export const soundcheckCheckProviderExtensionPoint =
  createExtensionPoint<SoundcheckCheckProviderExtensionPoint>({
    id: 'soundcheck.check-providers',
  });
