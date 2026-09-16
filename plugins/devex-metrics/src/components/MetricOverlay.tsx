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

import Box from '@material-ui/core/Box';
import { Select, SelectedItems, SelectItem } from '@backstage/core-components';
import { DoraMetricName } from '@backstage/plugin-devex-metrics-common';

/**
 * How a chart's overlay comparison series is sourced.
 *
 * - `off` — no overlay.
 * - `previous-period` — the same metric, shifted back by one period length.
 * - `metric` — a different metric plotted over the same time range.
 *
 * @public
 */
export type OverlayMode = 'off' | 'previous-period' | 'metric';

const MODE_ITEMS: SelectItem[] = [
  { label: 'No comparison', value: 'off' },
  { label: 'Compare: previous period', value: 'previous-period' },
  { label: 'Compare: another metric', value: 'metric' },
];

/**
 * Props for {@link MetricOverlay}.
 *
 * @public
 */
export interface MetricOverlayProps {
  readonly mode: OverlayMode;
  readonly onModeChange: (mode: OverlayMode) => void;
  /** The metric this overlay is attached to; excluded from the metric picker. */
  readonly excludeMetric: DoraMetricName;
  /** All metrics available for cross-metric comparison. */
  readonly availableMetrics: { title: string; metric: DoraMetricName }[];
  readonly metric?: DoraMetricName;
  readonly onMetricChange?: (metric: DoraMetricName) => void;
}

/**
 * Controls for toggling a chart's comparison overlay: off, the previous
 * period (rendered as a dashed line), or a different metric plotted over
 * the same range (cross-metric comparison).
 *
 * @public
 */
export function MetricOverlay(props: MetricOverlayProps): JSX.Element {
  const {
    mode,
    onModeChange,
    excludeMetric,
    availableMetrics,
    metric,
    onMetricChange,
  } = props;

  const metricItems: SelectItem[] = availableMetrics
    .filter(candidate => candidate.metric !== excludeMetric)
    .map(candidate => ({ label: candidate.title, value: candidate.metric }));

  function handleModeChange(selected: SelectedItems): void {
    onModeChange(
      String(Array.isArray(selected) ? selected[0] : selected) as OverlayMode,
    );
  }

  function handleMetricChange(selected: SelectedItems): void {
    onMetricChange?.(
      String(
        Array.isArray(selected) ? selected[0] : selected,
      ) as DoraMetricName,
    );
  }

  return (
    <Box display="flex" alignItems="flex-end" gridGap={8}>
      <Select
        label="Compare"
        items={MODE_ITEMS}
        selected={mode}
        onChange={handleModeChange}
      />
      {mode === 'metric' && (
        <Select
          label="Against metric"
          items={metricItems}
          selected={metric ?? metricItems[0]?.value ?? ''}
          onChange={handleMetricChange}
        />
      )}
    </Box>
  );
}
