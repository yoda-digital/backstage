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
import { AiGatewayApi, aiGatewayApiRef } from '../api/AiGatewayClient';
import { ProvidersPage } from './ProvidersPage';

function createApi(overrides: Partial<AiGatewayApi> = {}): AiGatewayApi {
  return {
    listProviders: jest.fn().mockResolvedValue([]),
    listModels: jest.fn().mockResolvedValue([]),
    getUsage: jest.fn().mockResolvedValue([]),
    getUsageSummary: jest.fn(),
    ...overrides,
  };
}

describe('ProvidersPage', () => {
  it('renders the AI providers page', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[aiGatewayApiRef, createApi()]]}>
        <ProvidersPage />
      </TestApiProvider>,
    );

    expect(await screen.findByText('AI Providers')).toBeInTheDocument();
    expect(screen.getByText('Manage AI model providers')).toBeInTheDocument();
  });

  it('lists registered providers from the API', async () => {
    const api = createApi({
      listProviders: jest.fn().mockResolvedValue([
        {
          providerId: 'openai',
          displayName: 'OpenAI',
          status: 'connected',
          modelCount: 3,
        },
      ]),
    });

    await renderInTestApp(
      <TestApiProvider apis={[[aiGatewayApiRef, api]]}>
        <ProvidersPage />
      </TestApiProvider>,
    );

    expect(await screen.findByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });
});
