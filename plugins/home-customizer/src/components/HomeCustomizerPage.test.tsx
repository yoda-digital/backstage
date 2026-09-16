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
import { permissionApiRef } from '@backstage/plugin-permission-react';
import { HomeCustomizerPage } from './HomeCustomizerPage';

describe('HomeCustomizerPage', () => {
  it('renders the home customizer page when access is allowed', async () => {
    const identityApi = mockApis.identity({
      userEntityRef: 'user:default/jane',
      ownershipEntityRefs: ['user:default/jane'],
    });
    const permissionApi = mockApis.permission();

    await renderInTestApp(
      <TestApiProvider
        apis={[
          [identityApiRef, identityApi],
          [permissionApiRef, permissionApi],
        ]}
      >
        <HomeCustomizerPage />
      </TestApiProvider>,
    );

    expect(await screen.findByText('Home Customizer')).toBeInTheDocument();
    expect(
      screen.getByText('Configure the default homepage widget layout'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Available widgets')).toBeInTheDocument();
  });
});
