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
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { OverlayApi, overlayApiRef } from '../api/ref';
import { OverlayEditor } from './OverlayEditor';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'service-a', namespace: 'default' },
  spec: { type: 'service', lifecycle: 'production', owner: 'platform' },
};

function createApi(overrides: Partial<OverlayApi> = {}): OverlayApi {
  return {
    listOverlays: jest.fn().mockResolvedValue([]),
    getOverlay: jest.fn().mockResolvedValue(undefined),
    setOverlay: jest.fn(),
    deleteOverlay: jest.fn(),
    ...overrides,
  };
}

describe('OverlayEditor', () => {
  it('renders the overlay editor for the current entity', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[overlayApiRef, createApi()]]}>
        <EntityProvider entity={entity}>
          <OverlayEditor />
        </EntityProvider>
      </TestApiProvider>,
    );

    expect(await screen.findByText('Tags')).toBeInTheDocument();
    expect(screen.getAllByText('Lifecycle').length).toBeGreaterThan(0);
    expect(screen.getByText('Current overlay patches')).toBeInTheDocument();
    expect(
      screen.getByText('Add or update an overlay patch'),
    ).toBeInTheDocument();
  });
});
