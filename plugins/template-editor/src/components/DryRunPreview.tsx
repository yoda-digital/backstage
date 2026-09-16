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

import { useMemo, useState } from 'react';
import { Button, Grid, Typography } from '@material-ui/core';
import { stringify } from 'yaml';
import { useApi, errorApiRef } from '@backstage/core-plugin-api';
import { CodeSnippet, InfoCard, Progress } from '@backstage/core-components';
import { scaffolderApiRef } from '@backstage/plugin-scaffolder-react';
import { ScaffolderDryRunResponse } from '@backstage/plugin-scaffolder-common';
import { ActionStep, FormField, TemplateMetadata } from '../types';
import { buildTemplate } from '../buildTemplate';

/**
 * Shows the generated template YAML and allows validating it against the
 * scaffolder's dry-run API.
 *
 * @public
 */
export function DryRunPreview(props: {
  metadata: TemplateMetadata;
  fields: FormField[];
  steps: ActionStep[];
}): JSX.Element {
  const { metadata, fields, steps } = props;
  const scaffolderApi = useApi(scaffolderApiRef);
  const errorApi = useApi(errorApiRef);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScaffolderDryRunResponse | undefined>();

  const template = useMemo(
    () => buildTemplate({ metadata, fields, steps }),
    [metadata, fields, steps],
  );
  const yamlText = useMemo(() => stringify(template), [template]);

  async function handleDryRun(): Promise<void> {
    setRunning(true);
    setResult(undefined);
    try {
      const response = await scaffolderApi.dryRun({
        template,
        values: {},
        directoryContents: [],
      });
      setResult(response);
    } catch (e) {
      errorApi.post(e as Error);
    } finally {
      setRunning(false);
    }
  }

  return (
    <InfoCard title="Template Preview">
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <CodeSnippet text={yamlText} language="yaml" showCopyCodeButton />
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            color="primary"
            disabled={running || steps.length === 0}
            onClick={handleDryRun}
          >
            Dry Run
          </Button>
        </Grid>
        {running && (
          <Grid item xs={12}>
            <Progress />
          </Grid>
        )}
        {result && (
          <Grid item xs={12}>
            <Typography variant="subtitle2">Log</Typography>
            <CodeSnippet
              text={result.log.map(entry => entry.body.message).join('\n')}
              language="text"
            />
            <Typography variant="subtitle2" style={{ marginTop: 16 }}>
              Output
            </Typography>
            <CodeSnippet text={stringify(result.output)} language="yaml" />
          </Grid>
        )}
      </Grid>
    </InfoCard>
  );
}
