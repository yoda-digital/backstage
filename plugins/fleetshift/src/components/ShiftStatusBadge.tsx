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
  StatusAborted,
  StatusError,
  StatusOK,
  StatusPending,
  StatusRunning,
} from '@backstage/core-components';
import { ShiftStatus } from '@backstage/plugin-fleetshift-common';

/**
 * Renders a status badge for a {@link @backstage/plugin-fleetshift-common#ShiftStatus}.
 *
 * @public
 */
export function ShiftStatusBadge(props: { status: ShiftStatus }): JSX.Element {
  const { status } = props;

  switch (status) {
    case 'completed':
      return <StatusOK>Completed</StatusOK>;
    case 'failed':
      return <StatusError>Failed</StatusError>;
    case 'partially_completed':
      return <StatusAborted>Partially completed</StatusAborted>;
    case 'executing':
      return <StatusRunning>Executing</StatusRunning>;
    case 'planning':
      return <StatusRunning>Planning</StatusRunning>;
    case 'planned':
      return <StatusPending>Planned</StatusPending>;
    case 'created':
    default:
      return <StatusPending>Created</StatusPending>;
  }
}
