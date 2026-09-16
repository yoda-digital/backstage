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
import { Grid, TextField } from '@material-ui/core';
import {
  Content,
  ContentHeader,
  Header,
  InfoCard,
  Page,
} from '@backstage/core-components';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { ActionStep, FormField, TemplateMetadata } from '../types';
import { templateEditorTranslationRef } from '../translation';
import { FormBuilder } from './FormBuilder';
import { ActionConfigurator } from './ActionConfigurator';
import { DryRunPreview } from './DryRunPreview';

const DEFAULT_METADATA: TemplateMetadata = {
  name: '',
  title: '',
  description: '',
  owner: '',
  type: 'service',
};

/**
 * A visual editor for scaffolder templates, combining a form field builder,
 * an action step configurator, and a dry-run preview.
 *
 * @public
 */
export function TemplateEditorPage(): JSX.Element {
  const { t } = useTranslationRef(templateEditorTranslationRef);
  const [metadata, setMetadata] = useState<TemplateMetadata>(DEFAULT_METADATA);
  const [fields, setFields] = useState<FormField[]>([]);
  const [steps, setSteps] = useState<ActionStep[]>([]);

  function updateMetadata(patch: Partial<TemplateMetadata>): void {
    setMetadata(prev => ({ ...prev, ...patch }));
  }

  return (
    <Page themeId="tool">
      <Header title={t('page.title')} subtitle={t('page.subtitle')} />
      <Content>
        <ContentHeader title={t('page.newTemplateHeading')} />
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <InfoCard title={t('page.metadataTitle')}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label={t('page.nameLabel')}
                    fullWidth
                    required
                    value={metadata.name}
                    onChange={e => updateMetadata({ name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label={t('page.titleLabel')}
                    fullWidth
                    value={metadata.title}
                    onChange={e => updateMetadata({ title: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label={t('page.typeLabel')}
                    fullWidth
                    value={metadata.type}
                    onChange={e => updateMetadata({ type: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={t('page.descriptionLabel')}
                    fullWidth
                    value={metadata.description}
                    onChange={e =>
                      updateMetadata({ description: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={t('page.ownerLabel')}
                    fullWidth
                    value={metadata.owner}
                    onChange={e => updateMetadata({ owner: e.target.value })}
                  />
                </Grid>
              </Grid>
            </InfoCard>
          </Grid>
          <Grid item xs={12}>
            <FormBuilder fields={fields} onChange={setFields} />
          </Grid>
          <Grid item xs={12}>
            <ActionConfigurator
              steps={steps}
              onChange={setSteps}
              formFields={fields}
            />
          </Grid>
          <Grid item xs={12}>
            <DryRunPreview metadata={metadata} fields={fields} steps={steps} />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
