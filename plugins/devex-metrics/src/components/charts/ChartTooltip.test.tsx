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
import { renderInTestApp } from '@backstage/test-utils';
import { ChartTooltip } from './ChartTooltip';

describe('ChartTooltip', () => {
  it('renders a title and labeled values, clamped inside its container', async () => {
    const { container } = await renderInTestApp(
      <ChartTooltip
        x={500}
        y={20}
        title="Jan 5"
        items={[
          { label: 'Deploys', value: 12, color: '#ff0000' },
          { label: 'Previous period', value: '8.00' },
        ]}
        containerWidth={300}
        width={160}
      />,
    );

    expect(await screen.findByText('Jan 5')).toBeInTheDocument();
    expect(screen.getByText('Deploys: 12')).toBeInTheDocument();
    expect(screen.getByText('Previous period: 8.00')).toBeInTheDocument();

    const root = container.firstChild as HTMLElement;
    expect(root.style.left).toBe('140px');
  });

  it('omits the title when none is given', async () => {
    await renderInTestApp(
      <ChartTooltip x={0} y={0} items={[{ label: 'Count', value: 3 }]} />,
    );

    expect(screen.getByText('Count: 3')).toBeInTheDocument();
    expect(screen.queryByText(/^Jan/)).not.toBeInTheDocument();
  });
});
