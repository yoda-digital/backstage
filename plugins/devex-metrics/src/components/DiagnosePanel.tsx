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

import { useState } from 'react';
import Button from '@material-ui/core/Button';
import Card from '@material-ui/core/Card';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import Collapse from '@material-ui/core/Collapse';
import Grid from '@material-ui/core/Grid';
import LinearProgress from '@material-ui/core/LinearProgress';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Typography from '@material-ui/core/Typography';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import WarningIcon from '@material-ui/icons/Warning';

/**
 * Describes which entities a set of dashboard queries were scoped to.
 *
 * @public
 */
export interface DiagnoseScope {
  /** The number of catalog entities matched by the current filters. */
  readonly entityCount: number;
  /** A human-readable description of the applied filter(s). */
  readonly filterDescription: string;
}

/**
 * Describes how much of the matched scope actually has metric data.
 *
 * @public
 */
export interface DiagnoseAttribution {
  /** Entities within scope that have at least one data point. */
  readonly withData: number;
  /** Total entities within scope. */
  readonly total: number;
}

/**
 * Props for {@link DiagnosePanel}.
 *
 * @public
 */
export interface DiagnosePanelProps {
  readonly scope: DiagnoseScope;
  readonly attribution: DiagnoseAttribution;
  /** Data completeness warnings, e.g. metrics with no results in range. */
  readonly warnings: string[];
  /** Entities missing catalog annotations required for attribution. */
  readonly missingAnnotations: string[];
}

/**
 * An expandable panel, meant to sit at the bottom of the dashboard, that
 * explains why the metrics above look the way they do: how many entities
 * were matched, what share of them have data, and any completeness
 * warnings or missing catalog annotations.
 *
 * @public
 */
export function DiagnosePanel(props: DiagnosePanelProps): JSX.Element {
  const { scope, attribution, warnings, missingAnnotations } = props;
  const [expanded, setExpanded] = useState(false);

  const attributionPercent =
    attribution.total === 0
      ? 0
      : Math.round((attribution.withData / attribution.total) * 100);

  return (
    <Card variant="outlined">
      <CardActions>
        <Button
          size="small"
          onClick={() => setExpanded(current => !current)}
          endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        >
          Diagnose
        </Button>
        {warnings.length > 0 && (
          <Typography
            variant="caption"
            color="error"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <WarningIcon fontSize="inherit" /> {warnings.length} warning
            {warnings.length === 1 ? '' : 's'}
          </Typography>
        )}
      </CardActions>
      <Collapse in={expanded}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2">Query scope</Typography>
              <Typography variant="body2">
                {scope.entityCount} entities matched
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Filter: {scope.filterDescription}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2">Attribution</Typography>
              <Typography variant="body2">
                {attribution.withData} of {attribution.total} entities have data
                ({attributionPercent}%)
              </Typography>
              <LinearProgress
                variant="determinate"
                value={attributionPercent}
                style={{ marginTop: 4 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2">Completeness</Typography>
              {warnings.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  No completeness warnings.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {warnings.map(warning => (
                    <ListItem key={warning} disableGutters>
                      <ListItemText
                        primary={warning}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Grid>
            {missingAnnotations.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2">
                  Entities missing annotations
                </Typography>
                <List dense disablePadding>
                  {missingAnnotations.map(entityRef => (
                    <ListItem key={entityRef} disableGutters>
                      <ListItemText
                        primary={entityRef}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Collapse>
    </Card>
  );
}
