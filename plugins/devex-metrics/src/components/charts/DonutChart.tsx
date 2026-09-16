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

import { useId, useState } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';

/**
 * A single slice rendered by {@link DonutChart}.
 *
 * @public
 */
export interface DonutChartSegment {
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
  readonly segments: DonutChartSegment[];
  readonly size?: number;
  readonly title?: string;
  /** Called when a segment (in the ring or the legend) is clicked. */
  readonly onSegmentClick?: (segment: DonutChartSegment) => void;
}

const STROKE_WIDTH_RATIO = 0.22;

/**
 * Responsive, theme-aware SVG donut chart with a legend listing each
 * slice's label and percentage share of the total. Clicking a segment (in
 * the ring or the legend) highlights it and notifies `onSegmentClick`.
 *
 * @public
 */
export function DonutChart(props: DonutChartProps): JSX.Element {
  const { segments, title, onSegmentClick } = props;
  const size = props.size ?? 200;
  const theme = useTheme();
  const titleId = useId();
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const total = segments.reduce(
    (sum, segment) => sum + Math.max(segment.value, 0),
    0,
  );
  const radius = size / 2;
  const strokeWidth = size * STROKE_WIDTH_RATIO;
  const innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * innerRadius;

  let cumulativeFraction = 0;
  const slices = segments
    .filter(segment => segment.value > 0)
    .map(segment => {
      const fraction = total === 0 ? 0 : segment.value / total;
      const dashLength = fraction * circumference;
      const dashArray = `${dashLength} ${circumference - dashLength}`;
      const dashOffset = -cumulativeFraction * circumference;
      cumulativeFraction += fraction;
      return { ...segment, dashArray, dashOffset, fraction };
    });

  function handleClick(segment: DonutChartSegment) {
    setSelected(current =>
      current === segment.label ? undefined : segment.label,
    );
    onSegmentClick?.(segment);
  }

  return (
    <Box>
      {title && (
        <Typography variant="subtitle2" gutterBottom>
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
            stroke={theme.palette.divider}
            strokeWidth={strokeWidth}
          />
          {slices.map(slice => {
            const isSelected = selected === slice.label;
            const isDimmed = selected !== undefined && !isSelected;
            return (
              <circle
                key={slice.label}
                cx={radius}
                cy={radius}
                r={innerRadius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isSelected ? strokeWidth * 1.15 : strokeWidth}
                strokeDasharray={slice.dashArray}
                strokeDashoffset={slice.dashOffset}
                strokeLinecap="butt"
                opacity={isDimmed ? 0.35 : 1}
                style={{ cursor: onSegmentClick ? 'pointer' : undefined }}
                onClick={() => handleClick(slice)}
              >
                <title>{`${slice.label}: ${slice.value} (${(
                  slice.fraction * 100
                ).toFixed(0)}%)`}</title>
              </circle>
            );
          })}
        </g>
        <text
          x={radius}
          y={radius}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={theme.palette.text.primary}
          fontSize={size * 0.14}
          fontWeight={600}
        >
          {total}
        </text>
      </svg>
      <Box display="flex" flexWrap="wrap" gridGap={theme.spacing(1)} mt={1}>
        {segments.map(segment => {
          const percentage = total === 0 ? 0 : (segment.value / total) * 100;
          const isSelected = selected === segment.label;
          const isDimmed = selected !== undefined && !isSelected;
          return (
            <Box
              key={segment.label}
              display="flex"
              alignItems="center"
              gridGap={theme.spacing(0.5)}
              onClick={() => handleClick(segment)}
              style={{
                cursor: onSegmentClick ? 'pointer' : undefined,
                opacity: isDimmed ? 0.5 : 1,
              }}
            >
              <Box
                component="span"
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: segment.color,
                }}
              />
              <Typography
                variant="caption"
                style={{
                  color: theme.palette.text.secondary,
                  fontWeight: isSelected ? 700 : 400,
                }}
              >
                {segment.label} ({percentage.toFixed(0)}%)
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
