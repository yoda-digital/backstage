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

/**
 * The severity of an {@link AuditEvent}.
 * @public
 */
export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * A summary of the HTTP request that triggered an {@link AuditEvent}.
 * @public
 */
export interface AuditRequestDetails {
  readonly method: string;
  readonly path: string;
  readonly bodySummary?: string;
}

/**
 * A single audit event recorded by the system.
 * @public
 */
export interface AuditEvent {
  readonly id: string;
  readonly action: string;
  readonly actor: string;
  readonly entityRef?: string;
  readonly metadata?: Record<string, unknown>;
  readonly timestamp: string;
  readonly status: 'succeeded' | 'failed';
  readonly severity: AuditSeverity;
  readonly pluginId: string;
  readonly requestDetails?: AuditRequestDetails;
}

/**
 * Parameters for querying audit events.
 * @public
 */
export interface AuditQuery {
  readonly actor?: string;
  readonly entityRef?: string;
  readonly action?: string;
  readonly severity?: AuditSeverity;
  readonly pluginId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Result of an audit event query with pagination info.
 * @public
 */
export interface AuditQueryResult {
  readonly events: AuditEvent[];
  readonly totalCount: number;
}
