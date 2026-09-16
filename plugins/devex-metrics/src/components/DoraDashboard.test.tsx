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

import { fireEvent, screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { catalogApiMock } from '@backstage/plugin-catalog-react/testUtils';
import { SoundcheckApi, soundcheckApiRef } from '@backstage/plugin-soundcheck';
import {
  AiUsageMetrics,
  DoraMetricName,
  MetricQuery,
} from '@backstage/plugin-devex-metrics-common';
import { devexMetricsApiRef } from '../api/ref';
import { DoraDashboard } from './DoraDashboard';

const SAMPLE_POINTS: Record<DoraMetricName, { date: string; value: number }[]> =
  {
    deployment_frequency: [
      { date: '2026-01-05', value: 3 },
      { date: '2026-01-12', value: 5 },
    ],
    lead_time_for_changes: [{ date: '2026-01-05', value: 12 }],
    mean_time_to_restore: [{ date: '2026-01-05', value: 2 }],
    change_failure_rate: [],
  };

const SAMPLE_AI_USAGE: AiUsageMetrics = {
  totalRequests: 42,
  totalTokens: 12345,
  byProvider: { 'gpt-4': { requests: 30, tokens: 9000 } },
  byUser: { 'user:default/jane': { requests: 42, tokens: 12345 } },
  dataPoints: [{ date: '2026-01-05', value: 42 }],
};

function renderDashboard() {
  const devexMetricsApi = {
    queryDora: jest.fn(
      async (query: MetricQuery) => SAMPLE_POINTS[query.metric],
    ),
    getAiUsage: jest.fn(async () => SAMPLE_AI_USAGE),
    listSurveys: jest.fn(async () => []),
    createSurvey: jest.fn(),
    submitSurveyResponse: jest.fn(),
    getSurveyResults: jest.fn(async () => []),
  };

  const catalogApi = catalogApiMock({
    entities: [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Group',
        metadata: { name: 'platform', namespace: 'default' },
        spec: { type: 'team', children: [] },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'service-a', namespace: 'default' },
        spec: { type: 'service', lifecycle: 'production', owner: 'platform' },
      },
    ],
  });

  const soundcheckApi: Pick<SoundcheckApi, 'getTracks'> = {
    getTracks: jest.fn(async () => []),
  };

  return renderInTestApp(
    <TestApiProvider
      apis={[
        [devexMetricsApiRef, devexMetricsApi],
        [catalogApiRef, catalogApi],
        [soundcheckApiRef, soundcheckApi as SoundcheckApi],
      ]}
    >
      <DoraDashboard />
    </TestApiProvider>,
  );
}

describe('DoraDashboard', () => {
  it('renders all four DORA metric cards with data from the API', async () => {
    const { container } = await renderDashboard();

    expect(
      (await screen.findAllByText('Deployment Frequency')).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Lead Time for Changes').length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText('Mean Time to Restore').length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText('Change Failure Rate').length).toBeGreaterThan(
      0,
    );

    // Deployment frequency's latest value (5) is shown as the card headline.
    const headlines = Array.from(container.querySelectorAll('h4')).map(
      el => el.textContent,
    );
    expect(headlines).toContain('5');
    // Change failure rate has no data points, so it falls back to this text.
    expect(headlines).toContain('No data');
  });

  it('shows AI usage metrics when the AI usage tab is selected', async () => {
    const { container } = await renderDashboard();

    fireEvent.click(await screen.findByText('AI usage'));

    expect(await screen.findByText('Total AI requests')).toBeInTheDocument();
    const headlines = Array.from(container.querySelectorAll('h4')).map(
      el => el.textContent,
    );
    expect(headlines).toContain('42');
    expect(headlines).toContain('12345');
  });

  it('expands the diagnose panel to show query scope and attribution', async () => {
    await renderDashboard();

    fireEvent.click(await screen.findByText('Diagnose'));

    expect(await screen.findByText('Query scope')).toBeInTheDocument();
    expect(screen.getByText('Attribution')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No data points found for Change Failure Rate in this range',
      ),
    ).toBeInTheDocument();
  });
});
