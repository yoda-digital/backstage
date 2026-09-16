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
import { AiExplorerApi, aiExplorerApiRef } from '../api/AiExplorerClient';
import { RulesPage } from './RulesPage';

function createApi(overrides: Partial<AiExplorerApi> = {}): AiExplorerApi {
  return {
    listRules: jest.fn().mockResolvedValue([]),
    createRule: jest.fn(),
    updateRule: jest.fn(),
    deleteRule: jest.fn(),
    listSkills: jest.fn().mockResolvedValue([]),
    createSkill: jest.fn(),
    updateSkill: jest.fn(),
    deleteSkill: jest.fn(),
    listPlugins: jest.fn().mockResolvedValue([]),
    createPlugin: jest.fn(),
    ...overrides,
  };
}

describe('RulesPage', () => {
  it('renders the AI rules page', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[aiExplorerApiRef, createApi()]]}>
        <RulesPage />
      </TestApiProvider>,
    );

    expect(await screen.findByText('AI Rules')).toBeInTheDocument();
    expect(
      screen.getByText('Manage AI guardrails and policies'),
    ).toBeInTheDocument();
  });
});
