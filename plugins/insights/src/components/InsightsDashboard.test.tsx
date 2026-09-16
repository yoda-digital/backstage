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
import { InsightsApi, insightsApiRef } from '../api/ref';
import { InsightsDashboard } from './InsightsDashboard';

function createApi(overrides: Partial<InsightsApi> = {}): InsightsApi {
  return {
    recordEvent: jest.fn(),
    queryEvents: jest.fn().mockResolvedValue([]),
    getAggregations: jest.fn().mockResolvedValue([]),
    getTopFeatures: jest.fn().mockResolvedValue([]),
    getSearchAnalytics: jest
      .fn()
      .mockResolvedValue({ popularQueries: [], zeroResultQueries: [] }),
    ...overrides,
  };
}

describe('InsightsDashboard', () => {
  it('renders the insights dashboard', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[insightsApiRef, createApi()]]}>
        <InsightsDashboard />
      </TestApiProvider>,
    );

    expect(await screen.findByText('Insights')).toBeInTheDocument();
    expect(screen.getByText('Adoption Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Top Features')).toBeInTheDocument();
    expect(screen.getByText('Active Users (last 30 days)')).toBeInTheDocument();
  });
});
