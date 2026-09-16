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
import { useCallback, useMemo, useRef, useState } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';
import { ChartTooltip, ChartTooltipItem } from './ChartTooltip';

/**
 * A single measured value at a point in time, as consumed by
 * {@link TimeseriesChart}.
 *
 * @public
 */
export interface TimeseriesPoint {
  readonly date: string;
  readonly value: number;
}

/**
 * One line/area series drawn by {@link TimeseriesChart}.
 *
 * @public
 */
export interface TimeseriesSeries {
  readonly label: string;
  readonly data: TimeseriesPoint[];
  readonly color: string;
}

/**
 * Props for {@link TimeseriesChart}.
 *
 * @public
 */
export interface TimeseriesChartProps {
  /** The primary series, rendered as a solid line with an area fill. */
  readonly series: TimeseriesSeries[];
  /**
   * Optional comparison series (previous period or a different metric),
   * rendered as a dashed line without an area fill.
   */
  readonly overlay?: TimeseriesSeries[];
  readonly xLabel?: string;
  readonly yLabel?: string;
  readonly width?: number;
  readonly height?: number;
}

const Y_TICKS = 4;

function formatDate(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * Responsive, theme-aware SVG timeseries chart with an auto-scaled Y-axis,
 * a date-based X-axis, area fills under the primary series, an optional
 * dashed overlay for period-over-period or cross-metric comparison, and a
 * hover tooltip showing the exact value and date.
 *
 * @public
 */
export function TimeseriesChart(props: TimeseriesChartProps): JSX.Element {
  const { series, overlay = [], xLabel, yLabel } = props;
  const width = props.width ?? 640;
  const height = props.height ?? 280;
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | undefined>(undefined);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const margin = useMemo(
    () => ({
      top: 16,
      right: 16,
      bottom: 32 + (xLabel ? 16 : 0),
      left: 44 + (yLabel ? 14 : 0),
    }),
    [xLabel, yLabel],
  );

  const innerWidth = Math.max(width - margin.left - margin.right, 1);
  const innerHeight = Math.max(height - margin.top - margin.bottom, 1);

  const allSeries = useMemo(() => [...series, ...overlay], [series, overlay]);

  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const item of allSeries) {
      for (const point of item.data) {
        set.add(point.date);
      }
    }
    return Array.from(set).sort();
  }, [allSeries]);

  const valueMaps = useMemo(
    () =>
      new Map(
        allSeries.map(item => [
          item.label,
          new Map(item.data.map(point => [point.date, point.value])),
        ]),
      ),
    [allSeries],
  );

  const allValues = useMemo(
    () => allSeries.flatMap(item => item.data.map(point => point.value)),
    [allSeries],
  );

  const yMin = Math.min(0, ...allValues);
  const yMax = allValues.length > 0 ? Math.max(...allValues) : 1;
  const yRange = yMax - yMin || 1;

  const xFor = useCallback(
    (index: number): number =>
      dates.length <= 1
        ? margin.left + innerWidth / 2
        : margin.left + (index / (dates.length - 1)) * innerWidth,
    [dates.length, innerWidth, margin.left],
  );

  const yFor = useCallback(
    (value: number): number =>
      margin.top + innerHeight - ((value - yMin) / yRange) * innerHeight,
    [innerHeight, margin.top, yMin, yRange],
  );

  const pathFor = useCallback(
    (seriesItem: TimeseriesSeries): { line: string; area: string } => {
      const valueMap = valueMaps.get(seriesItem.label);
      const points = dates
        .map((date, index) => ({ index, value: valueMap?.get(date) }))
        .filter(
          (point): point is { index: number; value: number } =>
            typeof point.value === 'number',
        )
        .map(point => ({ x: xFor(point.index), y: yFor(point.value) }));

      if (points.length === 0) {
        return { line: '', area: '' };
      }

      const line = points
        .map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x},${point.y}`)
        .join(' ');
      const baseline = yFor(yMin);
      const area = `${line} L${points[points.length - 1].x},${baseline} L${
        points[0].x
      },${baseline} Z`;
      return { line, area };
    },
    [dates, valueMaps, xFor, yFor, yMin],
  );

  const yTicks = useMemo(
    () =>
      Array.from({ length: Y_TICKS + 1 }, (_, i) => {
        const value = yMin + (yRange * i) / Y_TICKS;
        return { value, y: yFor(value) };
      }),
    [yMin, yRange, yFor],
  );

  const xTickEvery = Math.max(1, Math.ceil(dates.length / 6));

  function handleMouseMove(event: ReactMouseEvent<SVGSVGElement>) {
    if (dates.length === 0) {
      return;
    }
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = rect.width === 0 ? 1 : width / rect.width;
    const localX = (event.clientX - rect.left) * scaleX;
    const ratio = (localX - margin.left) / innerWidth;
    const index = Math.round(ratio * (dates.length - 1));
    setHoverIndex(Math.min(Math.max(index, 0), dates.length - 1));

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (containerRect) {
      setTooltipPos({
        x: event.clientX - containerRect.left,
        y: event.clientY - containerRect.top,
      });
    }
  }

  function handleMouseLeave() {
    setHoverIndex(undefined);
  }

  const hoveredDate = hoverIndex !== undefined ? dates[hoverIndex] : undefined;
  const tooltipItems: ChartTooltipItem[] = [];
  if (hoveredDate) {
    for (const item of allSeries) {
      const value = valueMaps.get(item.label)?.get(hoveredDate);
      if (typeof value === 'number') {
        tooltipItems.push({
          label: item.label,
          value: formatValue(value),
          color: item.color,
        });
      }
    }
  }

  const rootStyle: CSSProperties = { position: 'relative' };

  return (
    <div ref={containerRef} style={rootStyle}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        style={{ display: 'block', maxWidth: width }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        role="img"
        aria-label={yLabel ?? 'Timeseries chart'}
      >
        {yTicks.map(tick => (
          <g key={tick.value}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={tick.y}
              y2={tick.y}
              stroke={theme.palette.divider}
              strokeWidth={1}
            />
            <text
              x={margin.left - 8}
              y={tick.y}
              textAnchor="end"
              dominantBaseline="middle"
              fill={theme.palette.text.secondary}
              fontSize={10}
            >
              {formatValue(tick.value)}
            </text>
          </g>
        ))}

        {dates.map((date, index) =>
          index % xTickEvery === 0 ? (
            <text
              key={date}
              x={xFor(index)}
              y={height - margin.bottom + 16}
              textAnchor="middle"
              fill={theme.palette.text.secondary}
              fontSize={10}
            >
              {formatDate(date)}
            </text>
          ) : null,
        )}

        {yLabel && (
          <text
            x={-(margin.top + innerHeight / 2)}
            y={12}
            transform="rotate(-90)"
            textAnchor="middle"
            fill={theme.palette.text.secondary}
            fontSize={10}
          >
            {yLabel}
          </text>
        )}

        {xLabel && (
          <text
            x={margin.left + innerWidth / 2}
            y={height - 4}
            textAnchor="middle"
            fill={theme.palette.text.secondary}
            fontSize={10}
          >
            {xLabel}
          </text>
        )}

        {overlay.map(seriesItem => {
          const { line } = pathFor(seriesItem);
          return line ? (
            <path
              key={`overlay-${seriesItem.label}`}
              d={line}
              fill="none"
              stroke={seriesItem.color}
              strokeWidth={2}
              strokeDasharray="4 3"
            />
          ) : null;
        })}

        {series.map(seriesItem => {
          const { line, area } = pathFor(seriesItem);
          if (!line) {
            return null;
          }
          return (
            <g key={seriesItem.label}>
              <path d={area} fill={seriesItem.color} fillOpacity={0.12} />
              <path
                d={line}
                fill="none"
                stroke={seriesItem.color}
                strokeWidth={2}
              />
            </g>
          );
        })}

        {hoveredDate && (
          <line
            x1={xFor(hoverIndex as number)}
            x2={xFor(hoverIndex as number)}
            y1={margin.top}
            y2={height - margin.bottom}
            stroke={theme.palette.divider}
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {hoveredDate && (
        <ChartTooltip
          x={tooltipPos.x}
          y={tooltipPos.y}
          title={formatDate(hoveredDate)}
          items={tooltipItems}
          containerWidth={width}
        />
      )}

      <Box display="flex" flexWrap="wrap" gridGap={theme.spacing(1.5)} mt={1}>
        {series.map(seriesItem => (
          <Box
            key={seriesItem.label}
            display="flex"
            alignItems="center"
            gridGap={4}
          >
            <Box
              component="span"
              aria-hidden
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: seriesItem.color,
              }}
            />
            <Typography
              variant="caption"
              style={{ color: theme.palette.text.secondary }}
            >
              {seriesItem.label}
            </Typography>
          </Box>
        ))}
        {overlay.map(seriesItem => (
          <Box
            key={`overlay-legend-${seriesItem.label}`}
            display="flex"
            alignItems="center"
            gridGap={4}
          >
            <Box
              component="span"
              aria-hidden
              style={{
                display: 'inline-block',
                width: 10,
                height: 0,
                borderTop: `2px dashed ${seriesItem.color}`,
              }}
            />
            <Typography
              variant="caption"
              style={{ color: theme.palette.text.secondary }}
            >
              {seriesItem.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </div>
  );
}
