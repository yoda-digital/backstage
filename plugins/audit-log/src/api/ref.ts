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
  AuditQuery,
  AuditQueryResult,
} from '@backstage/plugin-audit-log-common';

/**
 * API for querying audit log events from the audit-log-backend plugin.
 *
 * @public
 */
export interface AuditLogApi {
  /**
   * Queries audit events with optional filters and pagination.
   */
  queryEvents(query: AuditQuery): Promise<AuditQueryResult>;
}

/**
 * {@link @backstage/core-plugin-api#ApiRef} for the {@link AuditLogApi}.
 *
 * @public
 */
export const auditLogApiRef = createApiRef<AuditLogApi>({
  id: 'plugin.audit-log.service',
});
