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
import { renderInTestApp } from '@backstage/test-utils';
import { TimeseriesChart } from './TimeseriesChart';

const series = [
  {
    label: 'Deployment frequency',
    color: '#1976d2',
    data: [
      { date: '2026-01-01', value: 1 },
      { date: '2026-01-02', value: 3 },
      { date: '2026-01-03', value: 2 },
    ],
  },
];

const overlay = [
  {
    label: 'Previous period',
    color: '#9e9e9e',
    data: [
      { date: '2026-01-01', value: 2 },
      { date: '2026-01-02', value: 2 },
      { date: '2026-01-03', value: 2 },
    ],
  },
];

describe('TimeseriesChart', () => {
  it('renders a solid area path per series and a dashed path per overlay', async () => {
    const { container } = await renderInTestApp(
      <TimeseriesChart
        series={series}
        overlay={overlay}
        xLabel="Date"
        yLabel="Deploys"
      />,
    );

    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByText('Deployment frequency')).toBeInTheDocument();
    expect(screen.getByText('Previous period')).toBeInTheDocument();

    const dashedPaths = container.querySelectorAll('path[stroke-dasharray]');
    expect(dashedPaths).toHaveLength(1);

    // One area + one line for the main series.
    const solidPaths = container.querySelectorAll(
      'path:not([stroke-dasharray])',
    );
    expect(solidPaths).toHaveLength(2);
  });

  it('shows a tooltip with each series value on hover and hides it on mouse leave', async () => {
    await renderInTestApp(
      <TimeseriesChart series={series} overlay={overlay} />,
    );

    const svg = screen.getByRole('img');
    fireEvent.mouseMove(svg, { clientX: 40, clientY: 20 });

    expect(
      await screen.findByText(/Deployment frequency:/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Previous period:/)).toBeInTheDocument();

    fireEvent.mouseLeave(svg);
    expect(
      screen.queryByText(/Deployment frequency: \d/),
    ).not.toBeInTheDocument();
  });

  it('renders an empty chart without data', async () => {
    const { container } = await renderInTestApp(
      <TimeseriesChart series={[]} />,
    );
    expect(container.querySelectorAll('path')).toHaveLength(0);
  });
});
