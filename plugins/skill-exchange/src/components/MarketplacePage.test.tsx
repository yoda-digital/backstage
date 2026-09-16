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
import {
  mockApis,
  renderInTestApp,
  TestApiProvider,
} from '@backstage/test-utils';
import { identityApiRef } from '@backstage/core-plugin-api';
import { SkillExchangeApi, skillExchangeApiRef } from '../api/ref';
import { MarketplacePage } from './MarketplacePage';

function createApi(
  overrides: Partial<SkillExchangeApi> = {},
): SkillExchangeApi {
  return {
    listGigs: jest.fn().mockResolvedValue([]),
    getGig: jest.fn(),
    createGig: jest.fn(),
    updateGig: jest.fn(),
    deleteGig: jest.fn(),
    listApplications: jest.fn().mockResolvedValue([]),
    applyToGig: jest.fn(),
    updateApplication: jest.fn(),
    listMatches: jest.fn().mockResolvedValue([]),
    listSkills: jest.fn().mockResolvedValue([]),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    ...overrides,
  };
}

describe('MarketplacePage', () => {
  it('renders the skill exchange marketplace page', async () => {
    const identityApi = mockApis.identity({
      userEntityRef: 'user:default/jane',
      ownershipEntityRefs: ['user:default/jane'],
    });

    await renderInTestApp(
      <TestApiProvider
        apis={[
          [skillExchangeApiRef, createApi()],
          [identityApiRef, identityApi],
        ]}
      >
        <MarketplacePage />
      </TestApiProvider>,
    );

    expect(
      (await screen.findAllByText('Skill Exchange')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Internal gig marketplace')).toBeInTheDocument();
    expect(screen.getByText('All Gigs')).toBeInTheDocument();
    expect(screen.getByText('New gig')).toBeInTheDocument();
  });
});
