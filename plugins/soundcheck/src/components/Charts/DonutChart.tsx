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

import type { CSSProperties } from 'react';
import { useId } from 'react';
import { useTheme } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';

/**
 * A single slice rendered by {@link DonutChart}.
 *
 * @public
 */
export interface DonutChartDatum {
  readonly label: string;
  readonly value: number;
  readonly color: string;
}

/**
 * Props for {@link DonutChart}.
 *
 * @public
 */
export interface DonutChartProps {
  readonly data: DonutChartDatum[];
  readonly size?: number;
  readonly title?: string;
}

const STROKE_WIDTH_RATIO = 0.22;

/**
 * Responsive, theme-aware SVG donut chart with a legend listing each
 * slice's label and percentage share of the total.
 *
 * @public
 */
export function DonutChart(props: DonutChartProps) {
  const { data, title } = props;
  const size = props.size ?? 200;
  const theme = useTheme();
  const titleId = useId();

  const total = data.reduce((sum, datum) => sum + Math.max(datum.value, 0), 0);
  const radius = size / 2;
  const strokeWidth = size * STROKE_WIDTH_RATIO;
  const innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * innerRadius;

  const rootStyle: CSSProperties = {
    '--sc-chart-text': theme.palette.text.primary,
    '--sc-chart-text-secondary': theme.palette.text.secondary,
    '--sc-chart-track': theme.palette.divider,
  } as CSSProperties;

  let cumulativeFraction = 0;
  const slices = data
    .filter(datum => datum.value > 0)
    .map(datum => {
      const fraction = total === 0 ? 0 : datum.value / total;
      const dashLength = fraction * circumference;
      const dashArray = `${dashLength} ${circumference - dashLength}`;
      const dashOffset = -cumulativeFraction * circumference;
      cumulativeFraction += fraction;
      return { ...datum, dashArray, dashOffset, fraction };
    });

  return (
    <Box style={rootStyle}>
      {title && (
        <Typography
          variant="subtitle2"
          style={{ color: 'var(--sc-chart-text)' }}
          gutterBottom
        >
          {title}
        </Typography>
      )}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="auto"
        style={{ display: 'block', maxWidth: size }}
        role="img"
        aria-labelledby={title ? titleId : undefined}
      >
        {title && <title id={titleId}>{title}</title>}
        <g transform={`rotate(-90 ${radius} ${radius})`}>
          <circle
            cx={radius}
            cy={radius}
            r={innerRadius}
            fill="none"
            stroke="var(--sc-chart-track)"
            strokeWidth={strokeWidth}
          />
          {slices.map(slice => (
            <circle
              key={slice.label}
              cx={radius}
              cy={radius}
              r={innerRadius}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={slice.dashArray}
              strokeDashoffset={slice.dashOffset}
              strokeLinecap="butt"
            >
              <title>{`${slice.label}: ${slice.value} (${(
                slice.fraction * 100
              ).toFixed(0)}%)`}</title>
            </circle>
          ))}
        </g>
        <text
          x={radius}
          y={radius}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--sc-chart-text)"
          fontSize={size * 0.14}
          fontWeight={600}
        >
          {total}
        </text>
      </svg>
      <Box display="flex" flexWrap="wrap" gridGap={theme.spacing(1)} mt={1}>
        {data.map(datum => {
          const percentage = total === 0 ? 0 : (datum.value / total) * 100;
          return (
            <Box
              key={datum.label}
              display="flex"
              alignItems="center"
              gridGap={theme.spacing(0.5)}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: datum.color,
                }}
              />
              <Typography
                variant="caption"
                style={{ color: 'var(--sc-chart-text-secondary)' }}
              >
                {datum.label} ({percentage.toFixed(0)}%)
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
