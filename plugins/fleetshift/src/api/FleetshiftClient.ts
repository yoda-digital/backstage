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
  CreateShiftRequest,
  LogEntry,
  Shift,
  ShiftExecution,
  TargetDiff,
} from '@backstage/plugin-fleetshift-common';
import { FleetshiftApi } from './ref';

/**
 * Options for creating a {@link FleetshiftClient}.
 *
 * @public
 */
export interface FleetshiftClientOptions {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
}

/**
 * Default {@link FleetshiftApi} implementation that talks to the
 * fleetshift-backend REST API.
 *
 * @public
 */
export class FleetshiftClient implements FleetshiftApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  private constructor(options: FleetshiftClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  static create(options: FleetshiftClientOptions): FleetshiftClient {
    return new FleetshiftClient(options);
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = await this.discoveryApi.getBaseUrl('fleetshift');
    const response = await this.fetchApi.fetch(`${baseUrl}${path}`, init);
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return await response.json();
  }

  async listShifts(): Promise<Shift[]> {
    return this.fetchJson<Shift[]>('/shifts');
  }

  async getShift(id: string): Promise<Shift> {
    return this.fetchJson<Shift>(`/shifts/${encodeURIComponent(id)}`);
  }

  async createShift(request: CreateShiftRequest): Promise<Shift> {
    return this.fetchJson<Shift>('/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  async deleteShift(id: string): Promise<void> {
    await this.fetchJson<void>(`/shifts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async executeShift(id: string): Promise<void> {
    await this.fetchJson<void>(`/shifts/${encodeURIComponent(id)}/execute`, {
      method: 'POST',
    });
  }

  async getShiftResults(id: string): Promise<ShiftExecution[]> {
    return this.fetchJson<ShiftExecution[]>(
      `/shifts/${encodeURIComponent(id)}/results`,
    );
  }

  async getTargetLogs(
    shiftId: string,
    targetIndex: number,
  ): Promise<LogEntry[]> {
    return this.fetchJson<LogEntry[]>(
      `/shifts/${encodeURIComponent(shiftId)}/targets/${targetIndex}/logs`,
    );
  }

  async getTargetDiff(
    shiftId: string,
    targetIndex: number,
  ): Promise<TargetDiff> {
    return this.fetchJson<TargetDiff>(
      `/shifts/${encodeURIComponent(shiftId)}/targets/${targetIndex}/diff`,
    );
  }

  async retryTarget(shiftId: string, targetIndex: number): Promise<void> {
    await this.fetchJson<void>(
      `/shifts/${encodeURIComponent(shiftId)}/targets/${targetIndex}/retry`,
      { method: 'POST' },
    );
  }
}
