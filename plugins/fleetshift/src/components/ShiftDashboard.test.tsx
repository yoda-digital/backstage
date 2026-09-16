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

import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { FleetshiftApi, fleetshiftApiRef } from '../api/ref';
import { ShiftDashboard } from './ShiftDashboard';

function createApi(overrides: Partial<FleetshiftApi> = {}): FleetshiftApi {
  return {
    listShifts: jest.fn().mockResolvedValue([]),
    getShift: jest.fn(),
    createShift: jest.fn(),
    deleteShift: jest.fn(),
    executeShift: jest.fn(),
    getShiftResults: jest.fn(),
    getTargetLogs: jest.fn(),
    getTargetDiff: jest.fn(),
    retryTarget: jest.fn(),
    ...overrides,
  };
}

describe('ShiftDashboard', () => {
  it('renders the fleetshift dashboard', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[fleetshiftApiRef, createApi()]]}>
        <ShiftDashboard />
      </TestApiProvider>,
    );

    expect(await screen.findByText('Fleetshift')).toBeInTheDocument();
    expect(screen.getByText('Shifts')).toBeInTheDocument();
    expect(screen.getByText('New Shift')).toBeInTheDocument();
  });

  it('shows an empty state when there are no shifts', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[fleetshiftApiRef, createApi()]]}>
        <ShiftDashboard />
      </TestApiProvider>,
    );

    expect(await screen.findByText('No shifts yet')).toBeInTheDocument();
  });
});
