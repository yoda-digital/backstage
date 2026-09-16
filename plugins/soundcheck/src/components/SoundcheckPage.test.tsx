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
import { SoundcheckApi, soundcheckApiRef } from '../api/ref';
import { SoundcheckPage } from './SoundcheckPage';

function createApi(): SoundcheckApi {
  const api: Pick<SoundcheckApi, 'getChecks'> = {
    getChecks: jest.fn().mockResolvedValue([]),
  };
  return api as SoundcheckApi;
}

describe('SoundcheckPage', () => {
  it('renders the Soundcheck page with its tabs', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[soundcheckApiRef, createApi()]]}>
        <SoundcheckPage />
      </TestApiProvider>,
    );

    expect((await screen.findAllByText('Checks')).length).toBeGreaterThan(0);
    expect(screen.getByText('Tracks')).toBeInTheDocument();
    expect(screen.getByText('Campaigns')).toBeInTheDocument();
    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('Create check')).toBeInTheDocument();
  });
});
