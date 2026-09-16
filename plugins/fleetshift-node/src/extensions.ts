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
import { ShiftTarget } from '@backstage/plugin-fleetshift-common';

/**
 * A provider implementation that knows how to clone repositories and open
 * merge/pull requests against a specific source control system, such as
 * GitLab or Azure DevOps.
 *
 * @public
 */
export interface FleetshiftProvider {
  readonly providerId: 'gitlab' | 'azure-devops';
  cloneRepo(target: ShiftTarget, workDir: string): Promise<void>;
  createMergeRequest(options: {
    target: ShiftTarget;
    workDir: string;
    title: string;
    description: string;
    branch: string;
  }): Promise<string>;
  getMrStatus(mrUrl: string): Promise<'open' | 'merged' | 'closed'>;
}

/**
 * The interface exposed by the {@link fleetshiftProviderExtensionPoint},
 * allowing modules to register {@link FleetshiftProvider} implementations.
 *
 * @public
 */
export interface FleetshiftProviderExtensionPoint {
  addProvider(provider: FleetshiftProvider): void;
}

/**
 * An extension point used to register {@link FleetshiftProvider}
 * implementations with the fleetshift backend plugin.
 *
 * @public
 */
export const fleetshiftProviderExtensionPoint =
  createExtensionPoint<FleetshiftProviderExtensionPoint>({
    id: 'fleetshift.provider',
  });
