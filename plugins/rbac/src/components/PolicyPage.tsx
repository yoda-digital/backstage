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
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import { Content, Header, Page } from '@backstage/core-components';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { PolicyList } from './PolicyList';
import { PolicyTester } from './PolicyTester';
import { rbacTranslationRef } from '../translation';

/**
 * The RBAC plugin's main page: a policy lifecycle management interface with
 * tabs for browsing/editing policies and for testing them against simulated
 * permission requests.
 */
export function PolicyPage(): JSX.Element {
  const { t } = useTranslationRef(rbacTranslationRef);
  const [tab, setTab] = useState(0);

  return (
    <Page themeId="tool">
      <Header title={t('page.title')} subtitle={t('page.subtitle')} />
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        indicatorColor="primary"
        textColor="primary"
      >
        <Tab label={t('page.tabPolicies')} />
        <Tab label={t('page.tabTester')} />
      </Tabs>
      <Content>
        {tab === 0 && <PolicyList />}
        {tab === 1 && <PolicyTester />}
      </Content>
    </Page>
  );
}
