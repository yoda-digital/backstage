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

/** @internal */
export type CatalogBuilderProviderId = 'gitlab' | 'azure';

/** @internal */
export type CatalogBuilderMode = 'portal-managed' | 'yaml-managed';

/** @internal */
export type CatalogBuilderJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

/** @internal */
export interface ProviderInfo {
  id: CatalogBuilderProviderId;
  name: string;
  host: string;
  authenticated: boolean;
}

/** @internal */
export interface OrganizationInfo {
  id: string;
  name: string;
  description?: string;
  repoCount?: number;
}

/** @internal */
export interface RepositoryInfo {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  url: string;
  defaultBranch: string;
  language?: string;
  lastActivityAt?: string;
  hasCatalogInfo: boolean;
}

/** @internal */
export interface IngestionJobError {
  repository: string;
  message: string;
}

/** @internal */
export interface IngestionJob {
  id: string;
  provider: CatalogBuilderProviderId;
  organization: string;
  mode: CatalogBuilderMode;
  status: CatalogBuilderJobStatus;
  totalRepos: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: IngestionJobError[];
  createdBy: string;
  createdAt: string;
  completedAt?: string;
}

/** @internal */
export interface IngestionDetails {
  kind?: string;
  lifecycle?: string;
  system?: string;
  tags?: string[];
}

/** @internal */
export interface IngestRequest {
  provider: CatalogBuilderProviderId;
  organization: string;
  mode: CatalogBuilderMode;
  repositories: RepositoryInfo[];
  details?: IngestionDetails;
}
