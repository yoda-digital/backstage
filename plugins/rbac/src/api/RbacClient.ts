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
  RbacPolicyRecord,
  RbacRole,
  RbacRoleBinding,
  RbacSubject,
} from '@backstage/plugin-rbac-common';
import {
  CreateRbacPolicyInput,
  RbacApi,
  RbacPolicyTestResult,
  RbacPolicyWithRoles,
  TestRbacPolicyInput,
  UpdateRbacPolicyInput,
} from './ref';

/**
 * An {@link RbacApi} implementation that talks to the RBAC backend plugin
 * over HTTP.
 *
 * @public
 */
export class RbacClient implements RbacApi {
  private constructor(
    private readonly discoveryApi: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}

  static create(options: {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
  }): RbacClient {
    return new RbacClient(options.discoveryApi, options.fetchApi);
  }

  private async baseUrl(): Promise<string> {
    return await this.discoveryApi.getBaseUrl('rbac');
  }

  async listRoles(): Promise<RbacRole[]> {
    const url = `${await this.baseUrl()}/roles`;
    const res = await this.fetchApi.fetch(url);
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return res.json();
  }

  async getRole(name: string): Promise<RbacRole> {
    const url = `${await this.baseUrl()}/roles/${encodeURIComponent(name)}`;
    const res = await this.fetchApi.fetch(url);
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return res.json();
  }

  async createRole(role: Omit<RbacRole, 'metadata'>): Promise<void> {
    const url = `${await this.baseUrl()}/roles`;
    const res = await this.fetchApi.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role),
    });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
  }

  async updateRole(name: string, role: Partial<RbacRole>): Promise<void> {
    const url = `${await this.baseUrl()}/roles/${encodeURIComponent(name)}`;
    const res = await this.fetchApi.fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role),
    });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
  }

  async deleteRole(name: string): Promise<void> {
    const url = `${await this.baseUrl()}/roles/${encodeURIComponent(name)}`;
    const res = await this.fetchApi.fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
  }

  async listBindings(role?: string): Promise<RbacRoleBinding[]> {
    const url = new URL(`${await this.baseUrl()}/bindings`);
    if (role) {
      url.searchParams.set('role', role);
    }
    const res = await this.fetchApi.fetch(url.toString());
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return res.json();
  }

  async addBinding(role: string, subject: RbacSubject): Promise<void> {
    const url = `${await this.baseUrl()}/bindings`;
    const res = await this.fetchApi.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, subject }),
    });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
  }

  async removeBinding(role: string, subject: RbacSubject): Promise<void> {
    const url = `${await this.baseUrl()}/bindings`;
    const res = await this.fetchApi.fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, subject }),
    });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
  }

  async listPolicies(): Promise<RbacPolicyRecord[]> {
    const url = `${await this.baseUrl()}/policies`;
    const res = await this.fetchApi.fetch(url);
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return res.json();
  }

  async getPolicy(id: string): Promise<RbacPolicyWithRoles> {
    const url = `${await this.baseUrl()}/policies/${encodeURIComponent(id)}`;
    const res = await this.fetchApi.fetch(url);
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return res.json();
  }

  async createPolicy(input: CreateRbacPolicyInput): Promise<RbacPolicyRecord> {
    const url = `${await this.baseUrl()}/policies`;
    const res = await this.fetchApi.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return res.json();
  }

  async updatePolicy(
    id: string,
    input: UpdateRbacPolicyInput,
  ): Promise<RbacPolicyRecord> {
    const url = `${await this.baseUrl()}/policies/${encodeURIComponent(id)}`;
    const res = await this.fetchApi.fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return res.json();
  }

  async deletePolicy(id: string): Promise<void> {
    const url = `${await this.baseUrl()}/policies/${encodeURIComponent(id)}`;
    const res = await this.fetchApi.fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
  }

  async publishPolicy(id: string): Promise<RbacPolicyRecord> {
    const url = `${await this.baseUrl()}/policies/${encodeURIComponent(
      id,
    )}/publish`;
    const res = await this.fetchApi.fetch(url, { method: 'POST' });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return res.json();
  }

  async republishPolicy(id: string): Promise<RbacPolicyRecord> {
    const url = `${await this.baseUrl()}/policies/${encodeURIComponent(
      id,
    )}/republish`;
    const res = await this.fetchApi.fetch(url, { method: 'POST' });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return res.json();
  }

  async testPolicy(
    id: string,
    input: TestRbacPolicyInput,
  ): Promise<RbacPolicyTestResult> {
    const url = `${await this.baseUrl()}/policies/${encodeURIComponent(
      id,
    )}/test`;
    const res = await this.fetchApi.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return res.json();
  }

  async exportPolicy(id: string): Promise<string> {
    const url = `${await this.baseUrl()}/policies/${encodeURIComponent(
      id,
    )}/export`;
    const res = await this.fetchApi.fetch(url);
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return res.text();
  }

  async importPolicy(content: string): Promise<RbacPolicyRecord> {
    const url = `${await this.baseUrl()}/policies/import`;
    const res = await this.fetchApi.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/yaml' },
      body: content,
    });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return res.json();
  }
}
