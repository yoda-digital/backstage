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

import { createApiRef } from '@backstage/core-plugin-api';
import {
  DatasetAccessRequest,
  DatasetMetadata,
  WarehouseConnection,
} from '@backstage/plugin-data-experience-common';

/**
 * API for interacting with the data-experience-backend REST API.
 *
 * @public
 */
export interface DataExperienceApi {
  /** Fetches warehouse-reported metadata for a dataset entity. */
  getMetadata(entityRef: string): Promise<DatasetMetadata>;
  /** Requests a refresh of the warehouse-reported metadata for a dataset. */
  refreshMetadata(entityRef: string): Promise<void>;
  /** Lists all configured warehouse connections. */
  listWarehouses(): Promise<WarehouseConnection[]>;
  /** Lists access requests, optionally filtered to a single dataset. */
  listAccessRequests(datasetRef?: string): Promise<DatasetAccessRequest[]>;
  /** Creates a new access request for a dataset. */
  requestAccess(
    datasetRef: string,
    reason: string,
  ): Promise<DatasetAccessRequest>;
}

/**
 * {@link @backstage/core-plugin-api#ApiRef} for the {@link DataExperienceApi}.
 *
 * @public
 */
export const dataExperienceApiRef = createApiRef<DataExperienceApi>({
  id: 'plugin.data-experience.api',
});
