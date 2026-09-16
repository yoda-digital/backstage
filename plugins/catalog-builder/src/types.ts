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

/** @public */
export type CatalogBuilderProviderId = 'gitlab' | 'azure';

/** @public */
export type CatalogBuilderMode = 'portal-managed' | 'yaml-managed';

/** @public */
export type CatalogBuilderJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

/** @public */
export interface ProviderInfo {
  id: CatalogBuilderProviderId;
  name: string;
  host: string;
  authenticated: boolean;
}

/** @public */
export interface OrganizationInfo {
  id: string;
  name: string;
  description?: string;
  repoCount?: number;
}

/** @public */
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

/** @public */
export interface IngestionJobError {
  repository: string;
  message: string;
}

/** @public */
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

/** @public */
export interface IngestionDetails {
  kind?: string;
  lifecycle?: string;
  system?: string;
  tags?: string[];
}

/** @public */
export interface IngestRequest {
  provider: CatalogBuilderProviderId;
  organization: string;
  mode: CatalogBuilderMode;
  repositories: RepositoryInfo[];
  details?: IngestionDetails;
}

/**
 * The mutable state that flows through each step of the {@link IngestionWizard}.
 *
 * @public
 */
export interface WizardState {
  provider?: ProviderInfo;
  mode?: CatalogBuilderMode;
  organization?: OrganizationInfo;
  repositories: RepositoryInfo[];
  selectedRepositoryIds: string[];
  details: IngestionDetails;
  job?: IngestionJob;
}
