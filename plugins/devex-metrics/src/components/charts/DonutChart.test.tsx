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
import { DonutChart } from './DonutChart';

const segments = [
  { label: 'GPT-4', value: 30, color: '#1976d2' },
  { label: 'Claude', value: 70, color: '#9c27b0' },
];

describe('DonutChart', () => {
  it('renders a legend entry with the percentage share for each segment', async () => {
    await renderInTestApp(<DonutChart segments={segments} title="Models" />);

    expect(screen.getAllByText('Models').length).toBeGreaterThan(0);
    expect(screen.getByText('GPT-4 (30%)')).toBeInTheDocument();
    expect(screen.getByText('Claude (70%)')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('notifies onSegmentClick and toggles highlight when a legend entry is clicked', async () => {
    const onSegmentClick = jest.fn();
    await renderInTestApp(
      <DonutChart segments={segments} onSegmentClick={onSegmentClick} />,
    );

    fireEvent.click(screen.getByText('GPT-4 (30%)'));
    expect(onSegmentClick).toHaveBeenCalledWith(segments[0]);

    fireEvent.click(screen.getByText('GPT-4 (30%)'));
    expect(onSegmentClick).toHaveBeenCalledTimes(2);
  });
});
