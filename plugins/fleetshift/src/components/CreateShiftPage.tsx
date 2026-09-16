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
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select as MuiSelect,
  TextField,
  Typography,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import { useApi, errorApiRef } from '@backstage/core-plugin-api';
import {
  Content,
  ContentHeader,
  Header,
  Page,
} from '@backstage/core-components';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import {
  AiAgentShiftConfig,
  CreateShiftRequest,
  NpmShiftConfig,
  OpenRewriteShiftConfig,
  ShiftConfig,
  ShiftTarget,
  ShiftType,
} from '@backstage/plugin-fleetshift-common';
import { fleetshiftApiRef } from '../api/ref';
import { fleetshiftTranslationRef } from '../translation';

const MODEL_OPTIONS = [
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { id: 'claude-haiku-4-20250514', label: 'Claude Haiku 4' },
];

function emptyTarget(): ShiftTarget {
  return { repoUrl: '', branch: 'main', provider: 'gitlab' };
}

/**
 * A page with a form for creating a new fleetshift shift, including the
 * shift type, its type-specific configuration, and its target repositories.
 *
 * @public
 */
export function CreateShiftPage(): JSX.Element {
  const { t } = useTranslationRef(fleetshiftTranslationRef);
  const api = useApi(fleetshiftApiRef);
  const errorApi = useApi(errorApiRef);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shiftType, setShiftType] = useState<ShiftType>('ai-agent');

  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState(MODEL_OPTIONS[0].id);

  const [packageName, setPackageName] = useState('');
  const [fromVersion, setFromVersion] = useState('');
  const [toVersion, setToVersion] = useState('');
  const [applyCodemods, setApplyCodemods] = useState(false);

  const [recipeName, setRecipeName] = useState('');
  const [recipeVersion, setRecipeVersion] = useState('');

  const [targets, setTargets] = useState<ShiftTarget[]>([emptyTarget()]);
  const [submitting, setSubmitting] = useState(false);

  function updateTarget(index: number, patch: Partial<ShiftTarget>): void {
    setTargets(prev =>
      prev.map((target, i) => (i === index ? { ...target, ...patch } : target)),
    );
  }

  function removeTarget(index: number): void {
    setTargets(prev => prev.filter((_, i) => i !== index));
  }

  function buildConfig(): ShiftConfig {
    switch (shiftType) {
      case 'npm-package':
        return {
          packageName,
          fromVersion,
          toVersion,
          applyCodemods,
        } satisfies NpmShiftConfig;
      case 'openrewrite':
        return { recipeName, recipeVersion } satisfies OpenRewriteShiftConfig;
      case 'ai-agent':
      default:
        return { prompt, modelId } satisfies AiAgentShiftConfig;
    }
  }

  function buildTransformation(): string {
    switch (shiftType) {
      case 'npm-package':
        return `Upgrade ${packageName} from ${fromVersion} to ${toVersion}`;
      case 'openrewrite':
        return `Apply OpenRewrite recipe ${recipeName}@${recipeVersion}`;
      case 'ai-agent':
      default:
        return prompt;
    }
  }

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    try {
      const shift = await api.createShift({
        title,
        description,
        transformation: buildTransformation(),
        shiftType,
        config: buildConfig(),
        targets,
      } satisfies CreateShiftRequest);
      navigate(`../${shift.id}`);
    } catch (e) {
      errorApi.post(e as Error);
    } finally {
      setSubmitting(false);
    }
  }

  let configValid = false;
  if (shiftType === 'ai-agent') {
    configValid = prompt.trim().length > 0;
  } else if (shiftType === 'npm-package') {
    configValid =
      packageName.trim().length > 0 &&
      fromVersion.trim().length > 0 &&
      toVersion.trim().length > 0;
  } else {
    configValid =
      recipeName.trim().length > 0 && recipeVersion.trim().length > 0;
  }

  const canSubmit =
    title.trim().length > 0 &&
    configValid &&
    targets.length > 0 &&
    targets.every(target => target.repoUrl.trim().length > 0);

  return (
    <Page themeId="tool">
      <Header
        title={t('createPage.title')}
        subtitle={t('createPage.subtitle')}
      />
      <Content>
        <ContentHeader title={t('createPage.heading')} />
        <Grid container spacing={2} style={{ maxWidth: 800 }}>
          <Grid item xs={12}>
            <TextField
              label="Title"
              fullWidth
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Description"
              fullWidth
              multiline
              minRows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel id="shift-type-label">Shift type</InputLabel>
              <MuiSelect
                labelId="shift-type-label"
                value={shiftType}
                onChange={e => setShiftType(e.target.value as ShiftType)}
              >
                <MenuItem value="ai-agent">AI Agent</MenuItem>
                <MenuItem value="npm-package">NPM Package</MenuItem>
                <MenuItem value="openrewrite">OpenRewrite</MenuItem>
              </MuiSelect>
            </FormControl>
          </Grid>

          {shiftType === 'ai-agent' && (
            <>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="model-label">Model</InputLabel>
                  <MuiSelect
                    labelId="model-label"
                    value={modelId}
                    onChange={e => setModelId(e.target.value as string)}
                  >
                    {MODEL_OPTIONS.map(option => (
                      <MenuItem key={option.id} value={option.id}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </MuiSelect>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Prompt"
                  helperText="Describe the code transformation to apply across the target repositories."
                  fullWidth
                  required
                  multiline
                  minRows={4}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                />
              </Grid>
            </>
          )}

          {shiftType === 'npm-package' && (
            <>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Package name"
                  fullWidth
                  required
                  value={packageName}
                  onChange={e => setPackageName(e.target.value)}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  label="From version"
                  fullWidth
                  required
                  value={fromVersion}
                  onChange={e => setFromVersion(e.target.value)}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  label="To version"
                  fullWidth
                  required
                  value={toVersion}
                  onChange={e => setToVersion(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={applyCodemods}
                      onChange={e => setApplyCodemods(e.target.checked)}
                    />
                  }
                  label="Codemods"
                />
              </Grid>
            </>
          )}

          {shiftType === 'openrewrite' && (
            <>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="Recipe name"
                  fullWidth
                  required
                  placeholder="org.openrewrite.java.migrate.UpgradeToJava17"
                  value={recipeName}
                  onChange={e => setRecipeName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Recipe version"
                  fullWidth
                  required
                  value={recipeVersion}
                  onChange={e => setRecipeVersion(e.target.value)}
                />
              </Grid>
            </>
          )}

          <Grid item xs={12}>
            <Typography variant="h6">Target repositories</Typography>
          </Grid>
          {targets.map((target, index) => (
            <Grid item xs={12} key={index}>
              <Grid container spacing={1} alignItems="center">
                <Grid item xs={12} sm={5}>
                  <TextField
                    label="Repository URL"
                    fullWidth
                    required
                    value={target.repoUrl}
                    onChange={e =>
                      updateTarget(index, { repoUrl: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Branch"
                    fullWidth
                    value={target.branch}
                    onChange={e =>
                      updateTarget(index, { branch: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={10} sm={3}>
                  <FormControl fullWidth>
                    <InputLabel id={`provider-label-${index}`}>
                      Provider
                    </InputLabel>
                    <MuiSelect
                      labelId={`provider-label-${index}`}
                      value={target.provider}
                      onChange={e =>
                        updateTarget(index, {
                          provider: e.target.value as ShiftTarget['provider'],
                        })
                      }
                    >
                      <MenuItem value="gitlab">GitLab</MenuItem>
                      <MenuItem value="azure-devops">Azure DevOps</MenuItem>
                    </MuiSelect>
                  </FormControl>
                </Grid>
                <Grid item xs={2} sm={1}>
                  <IconButton
                    aria-label="Remove target"
                    onClick={() => removeTarget(index)}
                    disabled={targets.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </Grid>
          ))}
          <Grid item xs={12}>
            <Button
              onClick={() => setTargets(prev => [...prev, emptyTarget()])}
            >
              Add target repository
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
            >
              Create Shift
            </Button>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
