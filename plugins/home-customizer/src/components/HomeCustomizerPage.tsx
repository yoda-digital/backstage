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

import { Content, Header, Page } from '@backstage/core-components';
import { useTranslationRef } from '@backstage/frontend-plugin-api';
import { RequirePermission } from '@backstage/plugin-permission-react';
import { homeCustomizerLayoutEditPermission } from '../permissions';
import { homeCustomizerTranslationRef } from '../translation';
import { LayoutEditor } from './LayoutEditor';

/**
 * The admin page for configuring the homepage widget layout. Access is
 * gated behind the {@link homeCustomizerLayoutEditPermission}.
 *
 * @public
 */
export function HomeCustomizerPage(): JSX.Element {
  const { t } = useTranslationRef(homeCustomizerTranslationRef);
  return (
    <Page themeId="tool">
      <Header title={t('page.title')} subtitle={t('page.subtitle')} />
      <Content>
        <RequirePermission permission={homeCustomizerLayoutEditPermission}>
          <LayoutEditor />
        </RequirePermission>
      </Content>
    </Page>
  );
}
