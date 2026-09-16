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
  CreateShiftRequest,
  LogEntry,
  Shift,
  ShiftExecution,
  TargetDiff,
} from '@backstage/plugin-fleetshift-common';

/**
 * API for interacting with the fleetshift-backend REST API.
 *
 * @public
 */
export interface FleetshiftApi {
  /** Lists all shifts. */
  listShifts(): Promise<Shift[]>;
  /** Fetches a single shift by id. */
  getShift(id: string): Promise<Shift>;
  /** Creates a new shift. */
  createShift(request: CreateShiftRequest): Promise<Shift>;
  /** Deletes a shift. */
  deleteShift(id: string): Promise<void>;
  /** Triggers execution of a planned shift. */
  executeShift(id: string): Promise<void>;
  /** Fetches the per-target execution results of a shift. */
  getShiftResults(id: string): Promise<ShiftExecution[]>;
  /** Fetches the accumulated logs for a single target of a shift. */
  getTargetLogs(shiftId: string, targetIndex: number): Promise<LogEntry[]>;
  /** Fetches the diff produced for a single target of a shift. */
  getTargetDiff(shiftId: string, targetIndex: number): Promise<TargetDiff>;
  /** Retries (or triggers PR creation for) a single target of a shift. */
  retryTarget(shiftId: string, targetIndex: number): Promise<void>;
}

/**
 * {@link @backstage/core-plugin-api#ApiRef} for the {@link FleetshiftApi}.
 *
 * @public
 */
export const fleetshiftApiRef = createApiRef<FleetshiftApi>({
  id: 'plugin.fleetshift.api',
});
