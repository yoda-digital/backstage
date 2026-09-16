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
  CreateGigRequest,
  Gig,
  GigApplication,
  GigMatch,
  SkillProfile,
} from '@backstage/plugin-skill-exchange-common';
import { GigQuery, SkillExchangeApi } from './ref';

/**
 * Options for creating a {@link SkillExchangeClient}.
 *
 * @public
 */
export interface SkillExchangeClientOptions {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
}

/**
 * Default {@link SkillExchangeApi} implementation that talks to the
 * skill-exchange-backend REST API.
 *
 * @public
 */
export class SkillExchangeClient implements SkillExchangeApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  private constructor(options: SkillExchangeClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  static create(options: SkillExchangeClientOptions): SkillExchangeClient {
    return new SkillExchangeClient(options);
  }

  private async baseUrl(): Promise<string> {
    return this.discoveryApi.getBaseUrl('skill-exchange');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = await this.baseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}${path}`, init);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return await response.json();
  }

  async listGigs(query?: GigQuery): Promise<Gig[]> {
    const params = new URLSearchParams();
    if (query?.type) {
      params.set('type', query.type);
    }
    if (query?.status) {
      params.set('status', query.status);
    }
    if (query?.direction) {
      params.set('direction', query.direction);
    }
    if (query?.createdBy) {
      params.set('createdBy', query.createdBy);
    }
    if (query?.skills) {
      for (const skill of query.skills) {
        params.append('skills', skill);
      }
    }
    return this.request<Gig[]>(`/gigs?${params}`);
  }

  async getGig(id: string): Promise<Gig> {
    return this.request<Gig>(`/gigs/${encodeURIComponent(id)}`);
  }

  async createGig(gig: CreateGigRequest): Promise<Gig> {
    return this.request<Gig>('/gigs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gig),
    });
  }

  async updateGig(id: string, updates: Partial<Gig>): Promise<void> {
    await this.request<void>(`/gigs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  }

  async deleteGig(id: string): Promise<void> {
    await this.request<void>(`/gigs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async listApplications(gigId?: string): Promise<GigApplication[]> {
    const params = new URLSearchParams();
    if (gigId) {
      params.set('gigId', gigId);
    }
    return this.request<GigApplication[]>(`/applications?${params}`);
  }

  async applyToGig(gigId: string, message?: string): Promise<GigApplication> {
    return this.request<GigApplication>('/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gigId, message }),
    });
  }

  async updateApplication(
    id: string,
    status: 'accepted' | 'rejected' | 'withdrawn',
  ): Promise<void> {
    await this.request<void>(`/applications/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  async listMatches(gigId?: string): Promise<GigMatch[]> {
    const params = new URLSearchParams();
    if (gigId) {
      params.set('gigId', gigId);
    }
    return this.request<GigMatch[]>(`/matches?${params}`);
  }

  async listSkills(): Promise<string[]> {
    return this.request<string[]>('/skills');
  }

  async getProfile(userRef?: string): Promise<SkillProfile> {
    const params = new URLSearchParams();
    if (userRef) {
      params.set('userRef', userRef);
    }
    return this.request<SkillProfile>(`/profile?${params}`);
  }

  async updateProfile(profile: Partial<SkillProfile>): Promise<void> {
    await this.request<void>('/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
  }
}
