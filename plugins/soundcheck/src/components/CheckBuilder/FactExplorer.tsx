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

import { CodeSnippet } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { useState } from 'react';
import {
  SoundcheckFactCollector,
  SoundcheckFactExploreResult,
  soundcheckApiRef,
} from '../../api/ref';

/**
 * Props for {@link FactExplorer}.
 *
 * @public
 */
export interface FactExplorerProps {
  factCollectors: SoundcheckFactCollector[];
  /** Pre-fills the fact ref field, e.g. with the check being authored's `factRef`. */
  initialFactRef?: string;
}

/**
 * Standalone panel for browsing the collected fact data for an entity —
 * helps check authors discover the shape of a fact and the paths available
 * to reference in a rule condition.
 *
 * @public
 */
export function FactExplorer(props: FactExplorerProps) {
  const { factCollectors, initialFactRef } = props;
  const api = useApi(soundcheckApiRef);

  const [factRef, setFactRef] = useState(initialFactRef ?? '');
  const [entityRef, setEntityRef] = useState('');
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [result, setResult] = useState<
    SoundcheckFactExploreResult | undefined
  >();

  async function handleFetch() {
    setLoading(true);
    setError(undefined);
    try {
      const response = await api.exploreFact(
        factRef,
        entityRef,
        path || undefined,
      );
      setResult(response);
    } catch (e) {
      setError(e as Error);
      setResult(undefined);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box display="flex" flexDirection="column" gridGap={16}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} sm={4}>
          <TextField
            select
            fullWidth
            size="small"
            label="Fact ref"
            value={factRef}
            onChange={event => setFactRef(event.target.value)}
          >
            {factCollectors.map(collector => (
              <MenuItem key={collector.factRef} value={collector.factRef}>
                {collector.factRef}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            size="small"
            label="Entity reference"
            placeholder="component:default/my-service"
            value={entityRef}
            onChange={event => setEntityRef(event.target.value)}
          />
        </Grid>
        <Grid item xs={8} sm={3}>
          <TextField
            fullWidth
            size="small"
            label="Path (optional)"
            placeholder="$.spec.version"
            value={path}
            onChange={event => setPath(event.target.value)}
          />
        </Grid>
        <Grid item xs={4} sm={1}>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            disabled={!factRef || !entityRef || loading}
            onClick={handleFetch}
          >
            Fetch
          </Button>
        </Grid>
      </Grid>

      {error && <Typography color="error">{error.message}</Typography>}

      {result && (
        <Box>
          {path && (
            <Box mb={1}>
              <Typography variant="subtitle2">
                Resolved value at <code>{path}</code>
              </Typography>
              <CodeSnippet
                text={JSON.stringify(
                  result.resolvedValue ?? null,
                  undefined,
                  2,
                )}
                language="json"
                showCopyCodeButton
              />
            </Box>
          )}
          <Typography variant="subtitle2">Fact data</Typography>
          {result.fact ? (
            <CodeSnippet
              text={JSON.stringify(result.fact, undefined, 2)}
              language="json"
              showLineNumbers
              showCopyCodeButton
            />
          ) : (
            <Typography color="textSecondary">
              No fact data has been collected for this entity yet.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
