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
import { RbacApi, rbacApiRef } from '../api/ref';
import { PolicyPage } from './PolicyPage';

function createApi(overrides: Partial<RbacApi> = {}): RbacApi {
  return {
    listRoles: jest.fn().mockResolvedValue([]),
    getRole: jest.fn(),
    createRole: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn(),
    listBindings: jest.fn().mockResolvedValue([]),
    addBinding: jest.fn(),
    removeBinding: jest.fn(),
    listPolicies: jest.fn().mockResolvedValue([]),
    getPolicy: jest.fn(),
    createPolicy: jest.fn(),
    updatePolicy: jest.fn(),
    deletePolicy: jest.fn(),
    publishPolicy: jest.fn(),
    republishPolicy: jest.fn(),
    testPolicy: jest.fn(),
    exportPolicy: jest.fn(),
    importPolicy: jest.fn(),
    ...overrides,
  };
}

describe('PolicyPage', () => {
  it('renders the RBAC policies page with its tabs', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[rbacApiRef, createApi()]]}>
        <PolicyPage />
      </TestApiProvider>,
    );

    expect(await screen.findByText('RBAC Policies')).toBeInTheDocument();
    expect(screen.getAllByText('Policies').length).toBeGreaterThan(0);
    expect(screen.getByText('Tester')).toBeInTheDocument();
  });
});
