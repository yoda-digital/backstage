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

import { screen } from '@testing-library/react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { scaffolderApiRef } from '@backstage/plugin-scaffolder-react';
import { scaffolderApiMock } from '@backstage/plugin-scaffolder-react/testUtils';
import { TemplateEditorPage } from './TemplateEditorPage';

describe('TemplateEditorPage', () => {
  it('renders the template editor page', async () => {
    const scaffolderApi = scaffolderApiMock.mock({
      listActions: jest.fn().mockResolvedValue([]),
    });

    await renderInTestApp(
      <TestApiProvider apis={[[scaffolderApiRef, scaffolderApi]]}>
        <TemplateEditorPage />
      </TestApiProvider>,
    );

    expect(await screen.findByText('Template Editor')).toBeInTheDocument();
    expect(
      screen.getByText('Visually build a scaffolder template'),
    ).toBeInTheDocument();
    expect(screen.getByText('New Template')).toBeInTheDocument();
    expect(screen.getByText('Template Metadata')).toBeInTheDocument();
  });
});
