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

import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { useMemo, useRef, useState } from 'react';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';
import { ChartTooltip } from './ChartTooltip';

/**
 * A single bucket rendered by {@link HistogramChart}.
 *
 * @public
 */
export interface HistogramBucket {
  readonly label: string;
  readonly value: number;
  readonly color?: string;
}

/**
 * Props for {@link HistogramChart}.
 *
 * @public
 */
export interface HistogramChartProps {
  readonly buckets: HistogramBucket[];
  readonly yLabel?: string;
  readonly width?: number;
  readonly height?: number;
}

const MARGIN = { top: 16, right: 16, bottom: 40, left: 40 };
const Y_TICKS = 4;

/**
 * Responsive, theme-aware SVG bar chart with an auto-scaled Y-axis and a
 * hover tooltip showing the bucket label and value.
 *
 * @public
 */
export function HistogramChart(props: HistogramChartProps): JSX.Element {
  const { buckets, yLabel } = props;
  const width = props.width ?? 480;
  const height = props.height ?? 240;
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | undefined>(undefined);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 1);
  const innerHeight = Math.max(height - MARGIN.top - MARGIN.bottom, 1);

  const maxValue = useMemo(
    () => Math.max(1, ...buckets.map(bucket => bucket.value)),
    [buckets],
  );

  const barWidth =
    buckets.length > 0 ? innerWidth / buckets.length : innerWidth;
  const barGap = Math.min(barWidth * 0.2, 12);

  function yFor(value: number): number {
    return MARGIN.top + innerHeight - (value / maxValue) * innerHeight;
  }

  const yTicks = Array.from({ length: Y_TICKS + 1 }, (_, i) => {
    const value = (maxValue * i) / Y_TICKS;
    return { value, y: yFor(value) };
  });

  function handleHover(index: number, event: ReactMouseEvent) {
    setHoverIndex(index);
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (containerRect) {
      setTooltipPos({
        x: event.clientX - containerRect.left,
        y: event.clientY - containerRect.top,
      });
    }
  }

  function handleLeave() {
    setHoverIndex(undefined);
  }

  if (buckets.length === 0) {
    return <Typography variant="body2">No data</Typography>;
  }

  const hovered = hoverIndex !== undefined ? buckets[hoverIndex] : undefined;
  const rootStyle: CSSProperties = { position: 'relative' };

  return (
    <div ref={containerRef} style={rootStyle}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        style={{ display: 'block', maxWidth: width }}
        role="img"
        aria-label={yLabel ?? 'Histogram'}
      >
        {yTicks.map(tick => (
          <g key={tick.value}>
            <line
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={tick.y}
              y2={tick.y}
              stroke={theme.palette.divider}
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={tick.y}
              textAnchor="end"
              dominantBaseline="middle"
              fill={theme.palette.text.secondary}
              fontSize={10}
            >
              {Math.round(tick.value)}
            </text>
          </g>
        ))}

        {buckets.map((bucket, index) => {
          const x = MARGIN.left + index * barWidth + barGap / 2;
          const barRenderWidth = Math.max(barWidth - barGap, 1);
          const y = yFor(bucket.value);
          const barHeight = Math.max(MARGIN.top + innerHeight - y, 0);
          const color = bucket.color ?? theme.palette.primary.main;
          const dimmed = hoverIndex !== undefined && hoverIndex !== index;
          return (
            <g key={bucket.label}>
              <rect
                x={x}
                y={y}
                width={barRenderWidth}
                height={barHeight}
                fill={color}
                opacity={dimmed ? 0.5 : 1}
                onMouseMove={event => handleHover(index, event)}
                onMouseLeave={handleLeave}
              />
              <text
                x={x + barRenderWidth / 2}
                y={height - MARGIN.bottom + 16}
                textAnchor="middle"
                fill={theme.palette.text.secondary}
                fontSize={10}
              >
                {bucket.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered && (
        <ChartTooltip
          x={tooltipPos.x}
          y={tooltipPos.y}
          title={hovered.label}
          items={[{ label: yLabel ?? 'Count', value: hovered.value }]}
          containerWidth={width}
        />
      )}
    </div>
  );
}
