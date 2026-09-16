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
import { useTheme } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';

/**
 * A single point in time for {@link LineChart}, carrying a numeric value
 * for each line/overlay series keyed by {@link LineChartSeries.key}.
 *
 * @public
 */
export interface LineChartDatum {
  readonly date: string;
  readonly values: Record<string, number>;
}

/**
 * Describes one series drawn by {@link LineChart}.
 *
 * @public
 */
export interface LineChartSeries {
  readonly key: string;
  readonly color: string;
  readonly label: string;
}

/**
 * Props for {@link LineChart}.
 *
 * @public
 */
export interface LineChartProps {
  readonly data: LineChartDatum[];
  readonly lines: LineChartSeries[];
  readonly overlay?: LineChartSeries[];
  readonly width?: number;
  readonly height?: number;
}

const MARGIN = { top: 16, right: 16, bottom: 32, left: 44 };
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

/**
 * Responsive, theme-aware SVG line chart with an auto-scaled Y-axis, a
 * date-based X-axis, an area fill under each line, and a hover tooltip.
 *
 * @public
 */
export function LineChart(props: LineChartProps) {
  const { data, lines, overlay = [] } = props;
  const width = props.width ?? 640;
  const height = props.height ?? 280;
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | undefined>(undefined);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 1);
  const innerHeight = Math.max(height - MARGIN.top - MARGIN.bottom, 1);
  const allSeries = useMemo(() => [...lines, ...overlay], [lines, overlay]);

  const allValues = useMemo(
    () =>
      data.flatMap(point =>
        allSeries
          .map(series => point.values[series.key])
          .filter((value): value is number => typeof value === 'number'),
      ),
    [data, allSeries],
  );

  const yMin = Math.min(0, ...allValues);
  const yMax = allValues.length > 0 ? Math.max(...allValues) : 1;
  const yRange = yMax - yMin || 1;

  const xFor = (index: number): number =>
    data.length <= 1
      ? MARGIN.left + innerWidth / 2
      : MARGIN.left + (index / (data.length - 1)) * innerWidth;

  const yFor = useCallback(
    (value: number): number =>
      MARGIN.top + innerHeight - ((value - yMin) / yRange) * innerHeight,
    [innerHeight, yMin, yRange],
  );

  const pathFor = (key: string): { line: string; area: string } => {
    const points = data
      .map((point, index) => ({ index, value: point.values[key] }))
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
  };

  const yTicks = useMemo(() => {
    return Array.from({ length: Y_TICKS + 1 }, (_, i) => {
      const value = yMin + (yRange * i) / Y_TICKS;
      return { value, y: yFor(value) };
    });
  }, [yMin, yRange, yFor]);

  const xTickEvery = Math.max(1, Math.ceil(data.length / 6));

  const rootStyle: CSSProperties = {
    '--sc-chart-text': theme.palette.text.primary,
    '--sc-chart-text-secondary': theme.palette.text.secondary,
    '--sc-chart-grid': theme.palette.divider,
    '--sc-chart-tooltip-bg': theme.palette.background.paper,
    position: 'relative',
  } as CSSProperties;

  function handleMouseMove(event: ReactMouseEvent<SVGSVGElement>) {
    if (data.length === 0) {
      return;
    }
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = width / rect.width;
    const localX = (event.clientX - rect.left) * scaleX;
    const ratio = (localX - MARGIN.left) / innerWidth;
    const index = Math.round(ratio * (data.length - 1));
    setHoverIndex(Math.min(Math.max(index, 0), data.length - 1));

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

  const hoveredPoint = hoverIndex !== undefined ? data[hoverIndex] : undefined;

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
      >
        {yTicks.map(tick => (
          <g key={tick.value}>
            <line
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={tick.y}
              y2={tick.y}
              stroke="var(--sc-chart-grid)"
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={tick.y}
              textAnchor="end"
              dominantBaseline="middle"
              fill="var(--sc-chart-text-secondary)"
              fontSize={10}
            >
              {Math.round(tick.value)}
            </text>
          </g>
        ))}

        {data.map((point, index) =>
          index % xTickEvery === 0 ? (
            <text
              key={point.date}
              x={xFor(index)}
              y={height - MARGIN.bottom + 16}
              textAnchor="middle"
              fill="var(--sc-chart-text-secondary)"
              fontSize={10}
            >
              {formatDate(point.date)}
            </text>
          ) : null,
        )}

        {overlay.map(series => {
          const { line } = pathFor(series.key);
          return line ? (
            <path
              key={series.key}
              d={line}
              fill="none"
              stroke={series.color}
              strokeWidth={2}
              strokeDasharray="4 3"
            />
          ) : null;
        })}

        {lines.map(series => {
          const { line, area } = pathFor(series.key);
          if (!line) {
            return null;
          }
          return (
            <g key={series.key}>
              <path d={area} fill={series.color} fillOpacity={0.12} />
              <path
                d={line}
                fill="none"
                stroke={series.color}
                strokeWidth={2}
              />
            </g>
          );
        })}

        {hoveredPoint && (
          <line
            x1={xFor(hoverIndex as number)}
            x2={xFor(hoverIndex as number)}
            y1={MARGIN.top}
            y2={height - MARGIN.bottom}
            stroke="var(--sc-chart-grid)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {hoveredPoint && (
        <Box
          style={{
            position: 'absolute',
            left: Math.min(tooltipPos.x + 12, width - 140),
            top: Math.max(tooltipPos.y - 12, 0),
            pointerEvents: 'none',
            backgroundColor: 'var(--sc-chart-tooltip-bg)',
            border: `1px solid var(--sc-chart-grid)`,
            borderRadius: 4,
            padding: theme.spacing(0.5, 1),
            boxShadow: theme.shadows[2],
            zIndex: 1,
          }}
        >
          <Typography
            variant="caption"
            component="div"
            style={{ color: 'var(--sc-chart-text)', fontWeight: 600 }}
          >
            {formatDate(hoveredPoint.date)}
          </Typography>
          {allSeries.map(series => {
            const value = hoveredPoint.values[series.key];
            if (typeof value !== 'number') {
              return null;
            }
            return (
              <Typography
                key={series.key}
                variant="caption"
                component="div"
                style={{ color: 'var(--sc-chart-text-secondary)' }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    marginRight: 4,
                    borderRadius: 2,
                    backgroundColor: series.color,
                  }}
                />
                {series.label}: {value}
              </Typography>
            );
          })}
        </Box>
      )}

      <Box display="flex" flexWrap="wrap" gridGap={theme.spacing(1.5)} mt={1}>
        {allSeries.map(series => (
          <Box key={series.key} display="flex" alignItems="center" gridGap={4}>
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: series.color,
              }}
            />
            <Typography
              variant="caption"
              style={{ color: 'var(--sc-chart-text-secondary)' }}
            >
              {series.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </div>
  );
}
