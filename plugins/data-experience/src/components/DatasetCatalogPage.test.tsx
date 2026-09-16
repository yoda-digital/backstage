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
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { catalogApiMock } from '@backstage/plugin-catalog-react/testUtils';
import { DataExperienceApi, dataExperienceApiRef } from '../api/ref';
import { DatasetCatalogPage } from './DatasetCatalogPage';

function createApi(
  overrides: Partial<DataExperienceApi> = {},
): DataExperienceApi {
  return {
    getMetadata: jest.fn(),
    refreshMetadata: jest.fn(),
    listWarehouses: jest.fn().mockResolvedValue([]),
    listAccessRequests: jest.fn().mockResolvedValue([]),
    requestAccess: jest.fn(),
    ...overrides,
  };
}

describe('DatasetCatalogPage', () => {
  it('renders the data experience catalog page', async () => {
    const catalogApi = catalogApiMock({ entities: [] });

    await renderInTestApp(
      <TestApiProvider
        apis={[
          [dataExperienceApiRef, createApi()],
          [catalogApiRef, catalogApi],
        ]}
      >
        <DatasetCatalogPage />
      </TestApiProvider>,
    );

    expect(await screen.findByText('Data Experience')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Discover and explore datasets across your organization',
      ),
    ).toBeInTheDocument();
  });
});
