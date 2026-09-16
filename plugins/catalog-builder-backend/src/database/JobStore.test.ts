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

import { TestDatabaseId, TestDatabases } from '@backstage/backend-test-utils';
import { NotFoundError } from '@backstage/errors';
import { JobStore } from './JobStore';

jest.setTimeout(60_000);

const databases = TestDatabases.create();

async function createStore(databaseId: TestDatabaseId) {
  const knex = await databases.init(databaseId);
  return JobStore.create({ database: knex });
}

describe.each(databases.eachSupportedId())('JobStore (%s)', databaseId => {
  it('creates a job with default progress counters', async () => {
    const store = await createStore(databaseId);
    const job = await store.createJob({
      provider: 'gitlab',
      organization: 'platform',
      mode: 'portal-managed',
      totalRepos: 3,
      createdBy: 'user:default/jane',
    });

    expect(job).toMatchObject({
      provider: 'gitlab',
      organization: 'platform',
      mode: 'portal-managed',
      status: 'pending',
      totalRepos: 3,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      createdBy: 'user:default/jane',
    });
    expect(job.id).toBeTruthy();
    expect(job.createdAt).toBeTruthy();
  });

  it('returns undefined for a missing job', async () => {
    const store = await createStore(databaseId);
    await expect(store.getJob('does-not-exist')).resolves.toBeUndefined();
  });

  it('updates progress counters and appends errors', async () => {
    const store = await createStore(databaseId);
    const job = await store.createJob({
      provider: 'azure',
      organization: 'my-project',
      mode: 'yaml-managed',
      totalRepos: 2,
      createdBy: 'user:default/jane',
    });

    await store.updateProgress(job.id, { status: 'running' });
    await store.updateProgress(job.id, {
      processed: 1,
      succeeded: 1,
      error: { repository: 'my-project/repo-b', message: 'boom' },
    });

    const updated = await store.getJob(job.id);
    expect(updated).toMatchObject({
      status: 'running',
      processed: 1,
      succeeded: 1,
      failed: 0,
      errors: [{ repository: 'my-project/repo-b', message: 'boom' }],
    });
  });

  it('records a completion timestamp on completion', async () => {
    const store = await createStore(databaseId);
    const job = await store.createJob({
      provider: 'gitlab',
      organization: 'platform',
      mode: 'portal-managed',
      totalRepos: 1,
      createdBy: 'user:default/jane',
    });

    await store.updateProgress(job.id, {
      status: 'completed',
      processed: 1,
      succeeded: 1,
    });

    const completed = await store.getJob(job.id);
    expect(completed?.status).toEqual('completed');
    expect(completed?.completedAt).toBeTruthy();
  });

  it('throws NotFoundError when updating a missing job', async () => {
    const store = await createStore(databaseId);
    await expect(
      store.updateProgress('does-not-exist', { status: 'running' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('lists jobs newest first', async () => {
    const store = await createStore(databaseId);
    const first = await store.createJob({
      provider: 'gitlab',
      organization: 'platform',
      mode: 'portal-managed',
      totalRepos: 1,
      createdBy: 'user:default/jane',
    });
    const second = await store.createJob({
      provider: 'gitlab',
      organization: 'platform',
      mode: 'portal-managed',
      totalRepos: 1,
      createdBy: 'user:default/jane',
    });

    const jobs = await store.listJobs();
    const ids = jobs.map(job => job.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });
});
