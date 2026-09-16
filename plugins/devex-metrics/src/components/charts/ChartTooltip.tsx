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
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';

/**
 * A single labeled value rendered inside a {@link ChartTooltip}.
 *
 * @public
 */
export interface ChartTooltipItem {
  readonly label: string;
  readonly value: string | number;
  readonly color?: string;
}

/**
 * Props for {@link ChartTooltip}.
 *
 * @public
 */
export interface ChartTooltipProps {
  /** Pointer X position, relative to the tooltip's positioned container. */
  readonly x: number;
  /** Pointer Y position, relative to the tooltip's positioned container. */
  readonly y: number;
  /** An optional heading, typically a date or bucket label. */
  readonly title?: string;
  /** The labeled values to display below the title. */
  readonly items: ChartTooltipItem[];
  /** Width of the positioned container, used to keep the tooltip on-screen. */
  readonly containerWidth?: number;
  /** Approximate tooltip width used for edge clamping. Defaults to 160. */
  readonly width?: number;
}

/**
 * A small floating tooltip that follows the pointer over a chart, showing an
 * optional title and a list of labeled, colored values. Must be rendered
 * inside a `position: relative` (or similarly positioned) container.
 *
 * @public
 */
export function ChartTooltip(props: ChartTooltipProps): JSX.Element {
  const { x, y, title, items, containerWidth, width = 160 } = props;
  const theme = useTheme();

  const left = containerWidth
    ? Math.min(x + 12, Math.max(containerWidth - width, 0))
    : x + 12;

  const style: CSSProperties = {
    position: 'absolute',
    left,
    top: Math.max(y - 12, 0),
    pointerEvents: 'none',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    padding: theme.spacing(0.5, 1),
    boxShadow: theme.shadows[2],
    zIndex: 1,
    minWidth: width,
  };

  return (
    <Box style={style}>
      {title && (
        <Typography
          variant="caption"
          component="div"
          style={{ color: theme.palette.text.primary, fontWeight: 600 }}
        >
          {title}
        </Typography>
      )}
      {items.map((item, index) => (
        <Typography
          key={`${item.label}-${index}`}
          variant="caption"
          component="div"
          style={{ color: theme.palette.text.secondary }}
        >
          {item.color && (
            <Box
              component="span"
              aria-hidden
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                marginRight: 4,
                borderRadius: 2,
                backgroundColor: item.color,
              }}
            />
          )}
          {item.label}: {item.value}
        </Typography>
      ))}
    </Box>
  );
}
