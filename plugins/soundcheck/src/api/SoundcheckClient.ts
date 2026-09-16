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

import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import {
  SoundcheckCampaign,
  SoundcheckCampaignInsights,
  SoundcheckCertification,
  SoundcheckCheck,
  SoundcheckCheckInsights,
  SoundcheckCheckResult,
  SoundcheckEntityFilter,
  SoundcheckFact,
  SoundcheckTrack,
  SoundcheckTrackInsights,
} from '@backstage/plugin-soundcheck-common';
import {
  SoundcheckApi,
  SoundcheckDryRunResult,
  SoundcheckFactCollector,
  SoundcheckFactExploreResult,
  SoundcheckImportReport,
} from './ref';

/**
 * Options for constructing a {@link SoundcheckClient}.
 *
 * @public
 */
export interface SoundcheckClientOptions {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
}

/**
 * Default implementation of the {@link SoundcheckApi} that talks to the
 * Soundcheck backend plugin over HTTP.
 *
 * @public
 */
export class SoundcheckClient implements SoundcheckApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  private constructor(options: SoundcheckClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  static create(options: SoundcheckClientOptions): SoundcheckClient {
    return new SoundcheckClient(options);
  }

  async getChecks(): Promise<SoundcheckCheck[]> {
    return this.get<SoundcheckCheck[]>('/checks');
  }

  async getTracks(): Promise<SoundcheckTrack[]> {
    return this.get<SoundcheckTrack[]>('/tracks');
  }

  async getCampaigns(): Promise<SoundcheckCampaign[]> {
    return this.get<SoundcheckCampaign[]>('/campaigns');
  }

  async getEntityResults(entityRef: string): Promise<SoundcheckCheckResult[]> {
    return this.get<SoundcheckCheckResult[]>(
      `/entities/${encodeURIComponent(entityRef)}/results`,
    );
  }

  async getEntityFacts(entityRef: string): Promise<SoundcheckFact[]> {
    return this.get<SoundcheckFact[]>(
      `/entities/${encodeURIComponent(entityRef)}/facts`,
    );
  }

  async getEntityCertifications(
    entityRef: string,
  ): Promise<SoundcheckCertification[]> {
    return this.get<SoundcheckCertification[]>(
      `/entities/${encodeURIComponent(entityRef)}/certifications`,
    );
  }

  async evaluateEntity(entityRef: string): Promise<SoundcheckCheckResult[]> {
    const url = `${await this.baseUrl()}/entities/${encodeURIComponent(
      entityRef,
    )}/evaluate`;
    const response = await this.fetchApi.fetch(url, { method: 'POST' });
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return response.json() as Promise<SoundcheckCheckResult[]>;
  }

  async saveCheck(
    check: SoundcheckCheck & { excludeFilter?: SoundcheckEntityFilter },
  ): Promise<SoundcheckCheck> {
    return this.post<SoundcheckCheck>('/checks', check);
  }

  async saveTrack(track: SoundcheckTrack): Promise<SoundcheckTrack> {
    return this.post<SoundcheckTrack>('/tracks', track);
  }

  async saveCampaign(
    campaign: SoundcheckCampaign,
  ): Promise<SoundcheckCampaign> {
    return this.post<SoundcheckCampaign>('/campaigns', campaign);
  }

  async dryRunCheck(
    check: SoundcheckCheck & { excludeFilter?: SoundcheckEntityFilter },
    entityRef: string,
  ): Promise<SoundcheckDryRunResult> {
    return this.post<SoundcheckDryRunResult>('/checks/dry-run', {
      check,
      entityRef,
    });
  }

  async getFactCollectors(): Promise<SoundcheckFactCollector[]> {
    return this.get<SoundcheckFactCollector[]>('/facts/collectors');
  }

  async exploreFact(
    factRef: string,
    entityRef: string,
    path?: string,
  ): Promise<SoundcheckFactExploreResult> {
    return this.post<SoundcheckFactExploreResult>('/facts/explore', {
      factRef,
      entityRef,
      path,
    });
  }

  async importChecks(
    yaml: string,
  ): Promise<SoundcheckImportReport<SoundcheckCheck>> {
    return this.post<SoundcheckImportReport<SoundcheckCheck>>(
      '/checks/import',
      { yaml },
    );
  }

  async importTracks(
    yaml: string,
  ): Promise<SoundcheckImportReport<SoundcheckTrack>> {
    return this.post<SoundcheckImportReport<SoundcheckTrack>>(
      '/tracks/import',
      { yaml },
    );
  }

  async exportChecks(ids?: string[]): Promise<string> {
    const query = ids?.length
      ? `?ids=${ids.map(encodeURIComponent).join(',')}`
      : '';
    return this.getText(`/checks/export${query}`);
  }

  async exportCheck(checkId: string): Promise<string> {
    return this.getText(`/checks/${encodeURIComponent(checkId)}/export`);
  }

  async exportTracks(): Promise<string> {
    return this.getText('/tracks/export');
  }

  async exportCampaigns(): Promise<string> {
    return this.getText('/campaigns/export');
  }

  async exportChecksCsv(
    checkId: string,
    filters?: { status?: string; limit?: number },
  ): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters?.status) {
      params.set('status', filters.status);
    }
    if (filters?.limit) {
      params.set('limit', String(filters.limit));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const url = `${await this.baseUrl()}/checks/${encodeURIComponent(
      checkId,
    )}/entities/csv${query}`;
    const response = await this.fetchApi.fetch(url);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return response.blob();
  }

  async getCheckInsights(
    checkId: string,
    range?: { from?: string; to?: string },
  ): Promise<SoundcheckCheckInsights> {
    const params = new URLSearchParams();
    if (range?.from) {
      params.set('from', range.from);
    }
    if (range?.to) {
      params.set('to', range.to);
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.get<SoundcheckCheckInsights>(
      `/checks/${encodeURIComponent(checkId)}/insights${query}`,
    );
  }

  async getTrackInsights(trackId: string): Promise<SoundcheckTrackInsights> {
    return this.get<SoundcheckTrackInsights>(
      `/tracks/${encodeURIComponent(trackId)}/insights`,
    );
  }

  async getCampaignInsights(
    campaignId: string,
  ): Promise<SoundcheckCampaignInsights> {
    return this.get<SoundcheckCampaignInsights>(
      `/campaigns/${encodeURIComponent(campaignId)}/insights`,
    );
  }

  private async baseUrl(): Promise<string> {
    return this.discoveryApi.getBaseUrl('soundcheck');
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${await this.baseUrl()}${path}`;
    const response = await this.fetchApi.fetch(url);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return response.json() as Promise<T>;
  }

  private async getText(path: string): Promise<string> {
    const url = `${await this.baseUrl()}${path}`;
    const response = await this.fetchApi.fetch(url);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return response.text();
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${await this.baseUrl()}${path}`;
    const response = await this.fetchApi.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return response.json() as Promise<T>;
  }
}
