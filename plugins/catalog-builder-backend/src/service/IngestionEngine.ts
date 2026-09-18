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

import {
  AuthService,
  BackstageCredentials,
  LoggerService,
  SchedulerService,
} from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import * as yaml from 'js-yaml';
import { InputError, NotFoundError } from '@backstage/errors';
import {
  AzureIntegration,
  DefaultAzureDevOpsCredentialsProvider,
  GitLabIntegration,
  getGitLabRequestOptions,
  ScmIntegrations,
} from '@backstage/integration';
import { Entity } from '@backstage/catalog-model';
import {
  CatalogService,
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { JobStore } from '../database/JobStore';
import {
  CatalogBuilderProviderId,
  IngestRequest,
  IngestionJob,
  OrganizationInfo,
  ProviderInfo,
  RepositoryInfo,
} from '../types';

const AZURE_API_VERSION = '7.1';

/**
 * An {@link EntityProvider} that lets the catalog-builder inject
 * Portal-managed entities directly into the catalog, without requiring a
 * `catalog-info.yaml` file to exist in the source repository.
 *
 * A single instance of this provider must be registered with the catalog's
 * processing extension point, and shared with the {@link IngestionEngine}
 * that emits entities through it.
 *
 * @internal
 */
export class CatalogBuilderEntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;

  getProviderName(): string {
    return 'CatalogBuilderEntityProvider';
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  async addEntities(entities: Entity[]): Promise<void> {
    if (!this.connection) {
      throw new Error(
        'CatalogBuilderEntityProvider has not been connected to the catalog yet',
      );
    }
    await this.connection.applyMutation({
      type: 'delta',
      added: entities.map(entity => ({
        entity,
        locationKey: this.getProviderName(),
      })),
      removed: [],
    });
  }
}

/** @internal */
export interface IngestionEngineOptions {
  config: Config;
  logger: LoggerService;
  store: JobStore;
  catalog: CatalogService;
  auth: AuthService;
  scheduler: SchedulerService;
  /** Overridable for testing. */
  fetchApi?: typeof fetch;
}

/**
 * Connects to configured SCM providers (GitLab, Azure DevOps) to list
 * organizations/groups and repositories, and orchestrates bulk ingestion of
 * selected repositories into the catalog.
 *
 * @internal
 */
export class IngestionEngine {
  private readonly config: Config;
  private readonly logger: LoggerService;
  private readonly store: JobStore;
  private readonly catalog: CatalogService;
  private readonly auth: AuthService;
  private readonly scheduler: SchedulerService;
  private readonly integrations: ScmIntegrations;
  private readonly fetchApi: typeof fetch;

  constructor(options: IngestionEngineOptions) {
    this.config = options.config;
    this.logger = options.logger;
    this.store = options.store;
    this.catalog = options.catalog;
    this.auth = options.auth;
    this.scheduler = options.scheduler;
    this.integrations = ScmIntegrations.fromConfig(options.config);
    this.fetchApi = options.fetchApi ?? fetch;
  }

  /** Lists the SCM providers configured for the catalog-builder. */
  listProviders(): ProviderInfo[] {
    const providers: ProviderInfo[] = [];

    const gitlabHost = this.config.getOptionalString(
      'catalogBuilder.providers.gitlab.host',
    );
    if (gitlabHost) {
      const integration = this.integrations.gitlab.byHost(gitlabHost);
      providers.push({
        id: 'gitlab',
        name: 'GitLab',
        host: gitlabHost,
        authenticated: Boolean(integration?.config.token),
      });
    }

    const azureOrganization = this.config.getOptionalString(
      'catalogBuilder.providers.azure.organization',
    );
    if (azureOrganization) {
      const azureHost =
        this.config.getOptionalString('catalogBuilder.providers.azure.host') ??
        'dev.azure.com';
      const integration = this.integrations.azure.byHost(azureHost);
      providers.push({
        id: 'azure',
        name: 'Azure DevOps',
        host: azureHost,
        authenticated: Boolean(integration?.config.credentials?.length),
      });
    }

    return providers;
  }

  /** Lists the organizations/groups available for a given provider. */
  async listOrganizations(
    providerId: CatalogBuilderProviderId,
  ): Promise<OrganizationInfo[]> {
    switch (providerId) {
      case 'gitlab':
        return this.listGitlabGroups();
      case 'azure':
        return this.listAzureProjects();
      default:
        throw new InputError(`Unknown catalog-builder provider ${providerId}`);
    }
  }

  /** Lists the repositories within a given organization/group. */
  async listRepositories(
    providerId: CatalogBuilderProviderId,
    organization: string,
  ): Promise<RepositoryInfo[]> {
    switch (providerId) {
      case 'gitlab':
        return this.listGitlabProjects(organization);
      case 'azure':
        return this.listAzureRepositories(organization);
      default:
        throw new InputError(`Unknown catalog-builder provider ${providerId}`);
    }
  }

  /**
   * Creates an ingestion job and schedules it to run asynchronously via the
   * scheduler, returning immediately with the freshly created job.
   */
  async startIngestion(
    request: IngestRequest,
    createdBy: string,
  ): Promise<IngestionJob> {
    const job = await this.store.createJob({
      provider: request.provider,
      organization: request.organization,
      mode: request.mode,
      totalRepos: request.repositories.length,
      createdBy,
    });

    const taskId = `catalog-builder:ingest:${job.id}`;
    await this.scheduler.scheduleTask({
      id: taskId,
      frequency: { trigger: 'manual' },
      timeout: { minutes: 30 },
      fn: async () => {
        await this.runIngestion(job.id, request);
      },
    });
    // Kick the manually-triggered task off immediately; the job's own status
    // transitions are what callers should poll rather than this promise.
    this.scheduler.triggerTask(taskId).catch(error => {
      this.logger.error(`Failed to trigger ingestion job ${job.id}: ${error}`);
    });

    return job;
  }

  async getJob(id: string): Promise<IngestionJob> {
    const job = await this.store.getJob(id);
    if (!job) {
      throw new NotFoundError(`No catalog-builder job found with id ${id}`);
    }
    return job;
  }

  private async runIngestion(
    jobId: string,
    request: IngestRequest,
  ): Promise<void> {
    await this.store.updateProgress(jobId, { status: 'running' });

    let succeeded = 0;
    let failed = 0;

    for (const repository of request.repositories) {
      try {
        if (request.mode === 'portal-managed') {
          await this.ingestPortalManaged(repository, request);
        } else {
          await this.ingestYamlManaged(repository);
        }
        succeeded += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(`Failed to ingest ${repository.fullName}: ${error}`);
        await this.store.updateProgress(jobId, {
          error: { repository: repository.fullName, message: String(error) },
        });
      }
      await this.store.updateProgress(jobId, {
        processed: succeeded + failed,
        succeeded,
        failed,
      });
    }

    await this.store.updateProgress(jobId, {
      status: failed > 0 && succeeded === 0 ? 'failed' : 'completed',
    });
  }

  private async ingestPortalManaged(
    repository: RepositoryInfo,
    request: IngestRequest,
  ): Promise<void> {
    const entity = this.buildComponentEntity(repository, request);
    const entityYaml = yaml.dump(entity);
    const name = entity.metadata.name;

    // Store entity YAML in DB so the router can serve it
    await this.store.storeEntity(name, entityYaml);

    // Tell the catalog to fetch the entity from our endpoint
    const credentials = await this.getCatalogCredentials();
    await this.catalog.addLocation(
      {
        type: 'url',
        target: `http://localhost:7007/api/catalog-builder/entities/${encodeURIComponent(name)}/catalog-info.yaml`,
      },
      { credentials },
    );
  }

  private async ingestYamlManaged(repository: RepositoryInfo): Promise<void> {
    if (!repository.hasCatalogInfo) {
      throw new Error(
        `${repository.fullName} has no catalog-info.yaml; open a merge/pull request to add one before ingesting in YAML-managed mode`,
      );
    }
    const credentials = await this.getCatalogCredentials();
    await this.catalog.addLocation(
      { type: 'url', target: this.catalogInfoUrl(repository) },
      { credentials },
    );
  }

  private buildComponentEntity(
    repository: RepositoryInfo,
    request: IngestRequest,
  ): Entity {
    const details = request.details ?? {};
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: details.kind ?? 'Component',
      metadata: {
        name: repository.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        description: repository.description,
        tags: details.tags,
        annotations: {
          'backstage.io/managed-by-location': `url:${repository.url}`,
          'backstage.io/managed-by-origin-location': `url:${repository.url}`,
          'catalog-builder/provider': request.provider,
          'catalog-builder/organization': request.organization,
          'backstage.io/title': repository.name,
        },
      },
      spec: {
        type: 'service',
        lifecycle: details.lifecycle ?? 'production',
        owner: 'unknown',
        system: details.system,
      },
    };
  }

  private catalogInfoUrl(repository: RepositoryInfo): string {
    return `${repository.url.replace(/\/$/, '')}/-/raw/${
      repository.defaultBranch
    }/catalog-info.yaml`;
  }

  private async getCatalogCredentials(): Promise<BackstageCredentials> {
    return this.auth.getOwnServiceCredentials();
  }

  // --- GitLab -------------------------------------------------------------

  private requireGitlabIntegration(): GitLabIntegration {
    const host = this.config.getOptionalString(
      'catalogBuilder.providers.gitlab.host',
    );
    if (!host) {
      throw new InputError(
        'No catalogBuilder.providers.gitlab.host configured',
      );
    }
    const integration = this.integrations.gitlab.byHost(host);
    if (!integration) {
      throw new InputError(
        `There is no GitLab integration for host ${host}. Add a configuration entry under integrations.gitlab`,
      );
    }
    return integration;
  }

  private async gitlabRequest<T>(
    integration: GitLabIntegration,
    endpoint: string,
  ): Promise<T> {
    const url = `${integration.config.apiBaseUrl}${endpoint}`;
    const response = await integration.fetch(
      url,
      getGitLabRequestOptions(integration.config),
    );
    if (!response.ok) {
      throw new Error(
        `GitLab request to ${url} failed with status ${response.status}`,
      );
    }
    return response.json();
  }

  private async gitlabHasCatalogInfo(
    integration: GitLabIntegration,
    projectId: number,
    branch: string,
  ): Promise<boolean> {
    const endpoint = `/projects/${projectId}/repository/files/catalog-info.yaml?ref=${encodeURIComponent(
      branch,
    )}`;
    const url = `${integration.config.apiBaseUrl}${endpoint}`;
    const response = await integration.fetch(url, {
      method: 'HEAD',
      headers: getGitLabRequestOptions(integration.config).headers,
    });
    return response.ok;
  }

  private async listGitlabGroups(): Promise<OrganizationInfo[]> {
    const integration = this.requireGitlabIntegration();
    const groups = await this.gitlabRequest<
      Array<{
        id: number;
        full_path: string;
        name: string;
        description?: string;
        projects_count?: number;
      }>
    >(integration, '/groups?per_page=100&all_available=true');

    return groups.map(group => ({
      id: group.full_path,
      name: group.name,
      description: group.description,
      repoCount: group.projects_count,
    }));
  }

  private async listGitlabProjects(
    groupPath: string,
  ): Promise<RepositoryInfo[]> {
    const integration = this.requireGitlabIntegration();
    const projects = await this.gitlabRequest<
      Array<{
        id: number;
        name: string;
        path_with_namespace: string;
        description?: string;
        web_url: string;
        default_branch?: string;
        last_activity_at?: string;
      }>
    >(
      integration,
      `/groups/${encodeURIComponent(
        groupPath,
      )}/projects?per_page=100&include_subgroups=true&archived=false`,
    );

    return Promise.all(
      projects.map(async project => ({
        id: String(project.id),
        name: project.name,
        fullName: project.path_with_namespace,
        description: project.description,
        url: project.web_url,
        defaultBranch: project.default_branch ?? 'main',
        lastActivityAt: project.last_activity_at,
        hasCatalogInfo: await this.gitlabHasCatalogInfo(
          integration,
          project.id,
          project.default_branch ?? 'main',
        ),
      })),
    );
  }

  // --- Azure DevOps ---------------------------------------------------------

  private azureContext(): {
    integration: AzureIntegration;
    organization: string;
    host: string;
  } {
    const organization = this.config.getOptionalString(
      'catalogBuilder.providers.azure.organization',
    );
    if (!organization) {
      throw new InputError(
        'No catalogBuilder.providers.azure.organization configured',
      );
    }
    const host =
      this.config.getOptionalString('catalogBuilder.providers.azure.host') ??
      'dev.azure.com';
    const integration = this.integrations.azure.byHost(host);
    if (!integration) {
      throw new InputError(
        `There is no Azure DevOps integration for host ${host}. Add a configuration entry under integrations.azure`,
      );
    }
    return { integration, organization, host };
  }

  private async azureRequest<T>(url: string): Promise<T> {
    const credentialsProvider =
      DefaultAzureDevOpsCredentialsProvider.fromIntegrations(this.integrations);
    const credentials = await credentialsProvider.getCredentials({ url });
    const response = await this.fetchApi(url, {
      headers: credentials?.headers,
    });
    if (!response.ok) {
      throw new Error(
        `Azure DevOps request to ${url} failed with status ${response.status}`,
      );
    }
    return response.json();
  }

  private async listAzureProjects(): Promise<OrganizationInfo[]> {
    const { organization, host } = this.azureContext();
    const url = `https://${host}/${organization}/_apis/projects?api-version=${AZURE_API_VERSION}&$top=1000`;
    const result = await this.azureRequest<{
      value: Array<{ id: string; name: string; description?: string }>;
    }>(url);

    return result.value.map(project => ({
      id: project.name,
      name: project.name,
      description: project.description,
    }));
  }

  private async azureHasCatalogInfo(
    host: string,
    organization: string,
    project: string,
    repositoryId: string,
    branch: string,
  ): Promise<boolean> {
    const url = `https://${host}/${organization}/${project}/_apis/git/repositories/${repositoryId}/items?path=/catalog-info.yaml&versionDescriptor.version=${encodeURIComponent(
      branch,
    )}&api-version=${AZURE_API_VERSION}`;
    try {
      await this.azureRequest(url);
      return true;
    } catch {
      return false;
    }
  }

  private async listAzureRepositories(
    project: string,
  ): Promise<RepositoryInfo[]> {
    const { organization, host } = this.azureContext();
    const url = `https://${host}/${organization}/${project}/_apis/git/repositories?api-version=${AZURE_API_VERSION}`;
    const result = await this.azureRequest<{
      value: Array<{
        id: string;
        name: string;
        webUrl: string;
        defaultBranch?: string;
        project: { name: string };
      }>;
    }>(url);

    return Promise.all(
      result.value.map(async repo => {
        const branch = (repo.defaultBranch ?? 'refs/heads/main').replace(
          'refs/heads/',
          '',
        );
        return {
          id: repo.id,
          name: repo.name,
          fullName: `${repo.project.name}/${repo.name}`,
          url: repo.webUrl,
          defaultBranch: branch,
          hasCatalogInfo: await this.azureHasCatalogInfo(
            host,
            organization,
            project,
            repo.id,
            branch,
          ),
        };
      }),
    );
  }
}
