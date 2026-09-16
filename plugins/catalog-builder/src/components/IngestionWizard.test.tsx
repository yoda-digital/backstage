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

import { TestApiProvider, renderInTestApp } from '@backstage/test-utils';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogBuilderApiRef, CatalogBuilderApi } from '../api/ref';
import { IngestionWizard } from './IngestionWizard';

function createApi(
  overrides: Partial<CatalogBuilderApi> = {},
): CatalogBuilderApi {
  return {
    listProviders: jest
      .fn()
      .mockResolvedValue([
        {
          id: 'gitlab',
          name: 'GitLab',
          host: 'gitlab.com',
          authenticated: true,
        },
      ]),
    listOrganizations: jest
      .fn()
      .mockResolvedValue([{ id: 'platform', name: 'Platform', repoCount: 1 }]),
    listRepositories: jest.fn().mockResolvedValue([
      {
        id: '1',
        name: 'repo-a',
        fullName: 'platform/repo-a',
        url: 'https://gitlab.com/platform/repo-a',
        defaultBranch: 'main',
        hasCatalogInfo: false,
      },
    ]),
    ingest: jest.fn().mockResolvedValue({
      id: 'job-1',
      provider: 'gitlab',
      organization: 'platform',
      mode: 'portal-managed',
      status: 'pending',
      totalRepos: 1,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      createdBy: 'user:default/mock',
      createdAt: new Date().toISOString(),
    }),
    getJob: jest.fn(),
    ...overrides,
  };
}

async function renderWizard(api: CatalogBuilderApi) {
  return renderInTestApp(
    <TestApiProvider apis={[[catalogBuilderApiRef, api]]}>
      <IngestionWizard />
    </TestApiProvider>,
  );
}

describe('IngestionWizard', () => {
  it('walks through the steps and starts an ingestion job', async () => {
    const api = createApi();
    await renderWizard(api);

    expect(await screen.findByText('GitLab')).toBeInTheDocument();
    await userEvent.click(screen.getByText('GitLab'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Portal-Managed')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Portal-Managed'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Platform'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('repo-a')).toBeInTheDocument();
    await userEvent.click(screen.getByText('repo-a'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await userEvent.click(
      screen.getByRole('button', { name: 'Start Ingestion' }),
    );

    await waitFor(() =>
      expect(api.ingest).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'gitlab',
          organization: 'platform',
          mode: 'portal-managed',
        }),
      ),
    );
  }, 20_000);

  it('disables Next until a provider is selected', async () => {
    const api = createApi();
    await renderWizard(api);

    expect(await screen.findByText('GitLab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
