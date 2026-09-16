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
  CatalogBuilderProviderId,
  IngestionJob,
  IngestRequest,
  OrganizationInfo,
  ProviderInfo,
  RepositoryInfo,
} from '../types';

/**
 * API for interacting with the catalog-builder-backend REST API.
 *
 * @public
 */
export interface CatalogBuilderApi {
  /** Lists the SCM providers configured for the catalog-builder. */
  listProviders(): Promise<ProviderInfo[]>;
  /** Lists the organizations/groups available for a given provider. */
  listOrganizations(
    provider: CatalogBuilderProviderId,
  ): Promise<OrganizationInfo[]>;
  /** Lists the repositories within a given organization/group. */
  listRepositories(
    provider: CatalogBuilderProviderId,
    organization: string,
  ): Promise<RepositoryInfo[]>;
  /** Starts a bulk ingestion job for the selected repositories. */
  ingest(request: IngestRequest): Promise<IngestionJob>;
  /** Fetches the current status of an ingestion job. */
  getJob(id: string): Promise<IngestionJob>;
}

/**
 * {@link @backstage/core-plugin-api#ApiRef} for the {@link CatalogBuilderApi}.
 *
 * @public
 */
export const catalogBuilderApiRef = createApiRef<CatalogBuilderApi>({
  id: 'plugin.catalog-builder.api',
});
