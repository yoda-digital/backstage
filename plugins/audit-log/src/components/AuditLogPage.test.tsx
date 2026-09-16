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
import { AuditLogApi, auditLogApiRef } from '../api/ref';
import { AuditLogPage } from './AuditLogPage';

function createApi(overrides: Partial<AuditLogApi> = {}): AuditLogApi {
  return {
    queryEvents: jest.fn().mockResolvedValue({ events: [], totalCount: 0 }),
    ...overrides,
  };
}

describe('AuditLogPage', () => {
  it('renders the audit log page with its filters', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[auditLogApiRef, createApi()]]}>
        <AuditLogPage />
      </TestApiProvider>,
    );

    expect(await screen.findByText('Audit Log')).toBeInTheDocument();
    expect(
      screen.getByText('Browse and filter audit events'),
    ).toBeInTheDocument();
  });
});
