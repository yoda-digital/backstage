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

import { useApi } from '@backstage/core-plugin-api';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { InfoCard } from '@backstage/core-components';
import { SoundcheckCheck } from '@backstage/plugin-soundcheck-common';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemText from '@material-ui/core/ListItemText';
import Snackbar from '@material-ui/core/Snackbar';
import Typography from '@material-ui/core/Typography';
import Alert from '@material-ui/lab/Alert';
import EditIcon from '@material-ui/icons/Edit';
import { useState } from 'react';
import { stringify } from 'yaml';
import { soundcheckApiRef } from '../api/ref';
import { soundcheckTranslationRef } from '../translation';

/**
 * A named, pre-built bundle of {@link SoundcheckCheck} definitions that a
 * user can apply in one step instead of authoring each check by hand.
 *
 * @public
 */
export interface CheckTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly checks: SoundcheckCheck[];
}

function existsCheck(input: {
  id: string;
  name: string;
  factRef: string;
}): SoundcheckCheck {
  return {
    id: input.id,
    name: input.name,
    description: `Verifies that ${input.name.toLowerCase()} is present.`,
    factRef: input.factRef,
    rule: { path: '$.exists', operator: 'equal', value: true },
  };
}

function enabledCheck(input: {
  id: string;
  name: string;
  factRef: string;
}): SoundcheckCheck {
  return {
    id: input.id,
    name: input.name,
    description: `Verifies that ${input.name.toLowerCase()} is enabled.`,
    factRef: input.factRef,
    rule: { path: '$.enabled', operator: 'equal', value: true },
  };
}

/**
 * Built-in Soundcheck check templates, covering common SCM hygiene and
 * GitLab repository settings.
 *
 * @public
 */
export const BUILT_IN_CHECK_TEMPLATES: CheckTemplate[] = [
  {
    id: 'scm-compliance',
    name: 'SCM compliance',
    description:
      'Baseline repository hygiene: the files every repository should have.',
    checks: [
      existsCheck({
        id: 'scm-readme-exists',
        name: 'README exists',
        factRef: 'scm:default/readme',
      }),
      existsCheck({
        id: 'scm-license-exists',
        name: 'LICENSE exists',
        factRef: 'scm:default/license',
      }),
      existsCheck({
        id: 'scm-contributing-exists',
        name: 'CONTRIBUTING exists',
        factRef: 'scm:default/contributing',
      }),
      existsCheck({
        id: 'scm-code-of-conduct-exists',
        name: 'CODE_OF_CONDUCT exists',
        factRef: 'scm:default/code-of-conduct',
      }),
      existsCheck({
        id: 'scm-gitignore-exists',
        name: '.gitignore exists',
        factRef: 'scm:default/gitignore',
      }),
      existsCheck({
        id: 'scm-codeowners-exists',
        name: 'CODEOWNERS exists',
        factRef: 'scm:default/codeowners',
      }),
    ],
  },
  {
    id: 'gitlab-settings',
    name: 'GitLab settings',
    description:
      'Recommended repository settings for projects hosted on GitLab.',
    checks: [
      enabledCheck({
        id: 'gitlab-branch-protection-enabled',
        name: 'Branch protection enabled',
        factRef: 'gitlab:default/branch-protection',
      }),
      enabledCheck({
        id: 'gitlab-mr-approvals-enabled',
        name: 'Merge request approvals enabled',
        factRef: 'gitlab:default/mr-approvals',
      }),
      enabledCheck({
        id: 'gitlab-ci-pipeline-enabled',
        name: 'CI pipeline enabled',
        factRef: 'gitlab:default/ci-pipeline',
      }),
      enabledCheck({
        id: 'gitlab-issue-tracking-enabled',
        name: 'Issue tracking enabled',
        factRef: 'gitlab:default/issue-tracking',
      }),
      enabledCheck({
        id: 'gitlab-registry-enabled',
        name: 'Container registry enabled',
        factRef: 'gitlab:default/registry',
      }),
      enabledCheck({
        id: 'gitlab-wiki-enabled',
        name: 'Wiki enabled',
        factRef: 'gitlab:default/wiki',
      }),
    ],
  },
];

/**
 * Props for {@link CheckTemplates}.
 *
 * @public
 */
export interface CheckTemplatesProps {
  /** Called after a template's checks have been imported. */
  onImported?: () => void;
  /**
   * Called when the user wants to review/edit a single template check
   * before saving it, typically by opening the check builder wizard with
   * this check as its `initialCheck`.
   */
  onCustomize?: (check: SoundcheckCheck) => void;
  /** The templates to show. Defaults to {@link BUILT_IN_CHECK_TEMPLATES}. */
  templates?: CheckTemplate[];
}

/**
 * Grid of pre-built Soundcheck check bundles ("templates") that can be
 * applied in one step via the checks YAML import endpoint, or reviewed one
 * check at a time in the check builder wizard.
 *
 * @public
 */
export function CheckTemplates(props: CheckTemplatesProps) {
  const {
    onImported,
    onCustomize,
    templates = BUILT_IN_CHECK_TEMPLATES,
  } = props;
  const api = useApi(soundcheckApiRef);
  const { t } = useTranslationRef(soundcheckTranslationRef);
  const [pendingId, setPendingId] = useState<string>();
  const [feedback, setFeedback] = useState<
    { severity: 'success' | 'error'; message: string } | undefined
  >();

  async function handleUseTemplate(template: CheckTemplate) {
    setPendingId(template.id);
    try {
      const report = await api.importChecks(stringify(template.checks));
      setFeedback({
        severity: 'success',
        message: t('checkTemplates.importSucceeded', {
          created: String(report.created.length),
          skipped: String(report.skipped.length),
          name: template.name,
        }),
      });
      onImported?.();
    } catch (e) {
      setFeedback({
        severity: 'error',
        message: t('checkTemplates.importFailed', {
          name: template.name,
          error: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      setPendingId(undefined);
    }
  }

  return (
    <>
      <Grid container spacing={2}>
        {templates.map(template => (
          <Grid item xs={12} md={6} key={template.id}>
            <InfoCard title={template.name} subheader={template.description}>
              <Typography variant="body2" color="textSecondary">
                {t('checkTemplates.checksCount', {
                  count: template.checks.length,
                })}
              </Typography>
              <List dense disablePadding>
                {template.checks.map(check => (
                  <ListItem key={check.id} disableGutters>
                    <ListItemText
                      primary={check.name}
                      secondary={check.description}
                    />
                    {onCustomize && (
                      <ListItemSecondaryAction>
                        <IconButton
                          size="small"
                          aria-label={t('checkTemplates.customizeButton')}
                          title={t('checkTemplates.customizeButton')}
                          onClick={() => onCustomize(check)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                ))}
              </List>
              <Button
                color="primary"
                variant="contained"
                disabled={pendingId === template.id}
                onClick={() => handleUseTemplate(template)}
              >
                {t('checkTemplates.useTemplateButton')}
              </Button>
            </InfoCard>
          </Grid>
        ))}
      </Grid>
      <Snackbar
        open={Boolean(feedback)}
        autoHideDuration={6000}
        onClose={() => setFeedback(undefined)}
      >
        {feedback ? (
          <Alert
            severity={feedback.severity}
            onClose={() => setFeedback(undefined)}
          >
            {feedback.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}
