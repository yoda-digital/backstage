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

import type {
  AuthService,
  DiscoveryService,
} from '@backstage/backend-plugin-api';
import type { RbacRole, RbacRoleBinding } from '@backstage/plugin-rbac-common';

/**
 * HTTP client for the RBAC backend REST API, used by the
 * permission policy module to evaluate roles without direct
 * database access.
 *
 * @internal
 */
export class RbacPolicyClient {
  private constructor(
    private readonly discovery: DiscoveryService,
    private readonly auth: AuthService,
  ) {}

  static create(options: {
    discovery: DiscoveryService;
    auth: AuthService;
  }): RbacPolicyClient {
    return new RbacPolicyClient(options.discovery, options.auth);
  }

  private async baseUrl(): Promise<string> {
    return this.discovery.getBaseUrl('rbac');
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const { token } = await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: 'rbac',
    });
    return { Authorization: `Bearer ${token}` };
  }

  async listRoles(): Promise<RbacRole[]> {
    const url = `${await this.baseUrl()}/roles`;
    const res = await fetch(url, { headers: await this.authHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to list RBAC roles: ${res.status}`);
    }
    return res.json() as Promise<RbacRole[]>;
  }

  async getRole(name: string): Promise<RbacRole | undefined> {
    const url = `${await this.baseUrl()}/roles/${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: await this.authHeaders() });
    if (res.status === 404) {
      return undefined;
    }
    if (!res.ok) {
      throw new Error(`Failed to get RBAC role: ${res.status}`);
    }
    return res.json() as Promise<RbacRole>;
  }

  async listBindings(): Promise<RbacRoleBinding[]> {
    const url = `${await this.baseUrl()}/bindings`;
    const res = await fetch(url, { headers: await this.authHeaders() });
    if (!res.ok) {
      throw new Error(`Failed to list RBAC bindings: ${res.status}`);
    }
    return res.json() as Promise<RbacRoleBinding[]>;
  }
}
