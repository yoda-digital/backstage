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

import LinearProgress from '@material-ui/core/LinearProgress';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';

/**
 * Props for {@link ProgressBar}.
 *
 * @public
 */
export interface ProgressBarProps {
  readonly value: number;
  readonly label: string;
  readonly color?: string;
}

const useStyles = makeStyles(theme => ({
  bar: {
    backgroundColor: (props: { color?: string }) =>
      props.color ?? theme.palette.primary.main,
  },
}));

/**
 * A labeled, colorable {@link https://v4.mui.com/api/linear-progress/ | MUI LinearProgress}
 * bar that also renders the current percentage as text.
 *
 * @public
 */
export function ProgressBar(props: ProgressBarProps) {
  const { label, color } = props;
  const classes = useStyles({ color });
  const value = Math.min(Math.max(props.value, 0), 100);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={0.5}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="textSecondary">
          {value.toFixed(0)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={value}
        classes={{ bar: classes.bar }}
      />
    </Box>
  );
}
