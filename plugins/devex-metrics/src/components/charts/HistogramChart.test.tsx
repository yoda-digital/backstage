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
import { HistogramChart } from './HistogramChart';

const buckets = [
  { label: '0-1h', value: 4 },
  { label: '1-4h', value: 9 },
  { label: '4h+', value: 2, color: '#e53935' },
];

describe('HistogramChart', () => {
  it('renders one bar and label per bucket', async () => {
    const { container } = await renderInTestApp(
      <HistogramChart buckets={buckets} yLabel="Count" />,
    );

    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(container.querySelectorAll('rect')).toHaveLength(buckets.length);
    for (const bucket of buckets) {
      expect(screen.getByText(bucket.label)).toBeInTheDocument();
    }
  });

  it('shows a tooltip with the bucket value on hover and hides it on leave', async () => {
    const { container } = await renderInTestApp(
      <HistogramChart buckets={buckets} yLabel="Count" />,
    );

    const bars = container.querySelectorAll('rect');
    fireEvent.mouseMove(bars[1], { clientX: 10, clientY: 10 });

    expect(await screen.findByText('Count: 9')).toBeInTheDocument();
    expect(screen.getAllByText('1-4h')).toHaveLength(2);

    fireEvent.mouseLeave(bars[1]);
    expect(screen.queryByText('Count: 9')).not.toBeInTheDocument();
  });

  it('renders a "No data" message when there are no buckets', async () => {
    await renderInTestApp(<HistogramChart buckets={[]} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});
