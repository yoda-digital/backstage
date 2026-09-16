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

import { SoundcheckCheck } from '@backstage/plugin-soundcheck-common';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import AddIcon from '@material-ui/icons/Add';
import PublishIcon from '@material-ui/icons/Publish';
import ViewModuleIcon from '@material-ui/icons/ViewModule';
import { useState } from 'react';
import { CheckBuilderWizard } from './CheckBuilder/CheckBuilderWizard';
import { CheckTemplates } from './CheckTemplates';
import { ChecksTable } from './ChecksTable';
import { ImportDialog } from './ImportDialog';
import { TracksOverview } from './TracksOverview';
import { CampaignsOverview } from './CampaignsOverview';
import { soundcheckTranslationRef } from '../translation';

const TABS = ['checks', 'tracks', 'campaigns', 'templates'] as const;
type SoundcheckTab = (typeof TABS)[number];

/**
 * Main Soundcheck page, showing checks, tracks, campaigns and check
 * templates in a tabbed layout.
 *
 * @public
 */
export function SoundcheckPage() {
  const { t } = useTranslationRef(soundcheckTranslationRef);
  const tabLabels: Record<SoundcheckTab, string> = {
    checks: t('page.tabChecks'),
    tracks: t('page.tabTracks'),
    campaigns: t('page.tabCampaigns'),
    templates: t('page.tabTemplates'),
  };

  const [tabIndex, setTabIndex] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<
    SoundcheckCheck | undefined
  >();
  const [refreshToken, setRefreshToken] = useState(0);

  const activeTab = TABS[tabIndex];

  function openCreateWizard() {
    setEditingCheck(undefined);
    setWizardOpen(true);
  }

  function openEditWizard(check: SoundcheckCheck) {
    setEditingCheck(check);
    setWizardOpen(true);
  }

  function handleSaved() {
    setRefreshToken(token => token + 1);
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Tabs
          value={tabIndex}
          onChange={(_event, value) => setTabIndex(value)}
          indicatorColor="primary"
          textColor="primary"
        >
          {TABS.map(tab => (
            <Tab key={tab} label={tabLabels[tab]} />
          ))}
        </Tabs>
        {activeTab === 'checks' && (
          <Box display="flex" gridGap={8}>
            <Button
              startIcon={<ViewModuleIcon />}
              onClick={() => setTabIndex(TABS.indexOf('templates'))}
            >
              {t('page.startFromTemplateButton')}
            </Button>
            <Button
              startIcon={<PublishIcon />}
              onClick={() => setImportOpen(true)}
            >
              {t('page.importButton')}
            </Button>
            <Button
              color="primary"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateWizard}
            >
              {t('page.createCheckButton')}
            </Button>
          </Box>
        )}
      </Box>
      <Box paddingTop={2}>
        {activeTab === 'checks' && (
          <ChecksTable onEdit={openEditWizard} refreshToken={refreshToken} />
        )}
        {activeTab === 'tracks' && <TracksOverview />}
        {activeTab === 'campaigns' && <CampaignsOverview />}
        {activeTab === 'templates' && (
          <CheckTemplates
            onImported={handleSaved}
            onCustomize={openEditWizard}
          />
        )}
      </Box>
      <CheckBuilderWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        initialCheck={editingCheck}
        onSaved={handleSaved}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        kind="checks"
        onImported={handleSaved}
      />
    </Box>
  );
}
