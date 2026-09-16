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

import express from 'express';
import request from 'supertest';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import {
  mockErrorHandler,
  mockServices,
  TestDatabases,
} from '@backstage/backend-test-utils';
import { SoundcheckStore } from '../database/SoundcheckStore';
import { CheckEngine } from '../engine/CheckEngine';
import { createRouter } from './router';

jest.setTimeout(60_000);

const databases = TestDatabases.create({ ids: ['SQLITE_3'] });

async function createApp(options?: {
  permissionsResult?: AuthorizeResult.ALLOW | AuthorizeResult.DENY;
}) {
  const knex = await databases.init('SQLITE_3');
  const store = await SoundcheckStore.create({ database: knex });
  const engine = new CheckEngine();
  const httpAuth = mockServices.httpAuth();
  const logger = mockServices.logger.mock();
  const permissions = mockServices.permissions({
    result: options?.permissionsResult ?? AuthorizeResult.ALLOW,
  });
  const events = mockServices.events.mock();

  await store.upsertCheck({
    id: 'readme-exists',
    name: 'README exists',
    description: '...',
    factRef: 'scm:default/readme',
    rule: { path: '$.exists', operator: 'equal', value: true },
  });

  const router = createRouter({
    store,
    engine,
    httpAuth,
    permissions,
    events,
    logger,
  });
  const app = express().use(router).use(mockErrorHandler());
  return { app, store, events };
}

describe('createRouter exemptions', () => {
  it('creates, lists, revokes and restores an exemption', async () => {
    const { app } = await createApp();

    const created = await request(app)
      .post('/exemptions')
      .send({
        checkId: 'readme-exists',
        entityRef: 'component:default/foo',
        reason: 'Third-party mirror, README lives upstream',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      checkId: 'readme-exists',
      entityRef: 'component:default/foo',
      status: 'active',
    });
    expect(created.body.grantedBy).toBeTruthy();
    const exemptionId = created.body.id;

    const listed = await request(app)
      .get('/exemptions')
      .query({ checkId: 'readme-exists' })
      .expect(200);
    expect(listed.body).toHaveLength(1);

    await request(app).post(`/exemptions/${exemptionId}/revoke`).expect(204);
    const afterRevoke = await request(app)
      .get('/exemptions')
      .query({ entityRef: 'component:default/foo' })
      .expect(200);
    expect(afterRevoke.body[0].status).toEqual('revoked');

    await request(app).post(`/exemptions/${exemptionId}/restore`).expect(204);
    const afterRestore = await request(app)
      .get('/exemptions')
      .query({ entityRef: 'component:default/foo' })
      .expect(200);
    expect(afterRestore.body[0].status).toEqual('active');
  });

  it('rejects an exemption request missing required fields', async () => {
    const { app } = await createApp();
    const response = await request(app)
      .post('/exemptions')
      .send({ checkId: 'readme-exists' });
    expect(response.status).toEqual(400);
  });

  it('reports exempt status instead of evaluating a check for an exempted entity', async () => {
    const { app, store } = await createApp();
    const entityRef = 'component:default/foo';

    await store.upsertFact({
      factRef: 'scm:default/readme',
      entityRef,
      data: { exists: false },
      collectedAt: new Date().toISOString(),
    });

    const beforeExemption = await request(app)
      .post(`/entities/${encodeURIComponent(entityRef)}/evaluate`)
      .expect(200);
    expect(beforeExemption.body).toEqual([
      expect.objectContaining({ checkId: 'readme-exists', status: 'fail' }),
    ]);

    await request(app)
      .post('/exemptions')
      .send({
        checkId: 'readme-exists',
        entityRef,
        reason: 'Grandfathered in',
      })
      .expect(201);

    const afterExemption = await request(app)
      .post(`/entities/${encodeURIComponent(entityRef)}/evaluate`)
      .expect(200);
    expect(afterExemption.body).toEqual([
      expect.objectContaining({ checkId: 'readme-exists', status: 'exempt' }),
    ]);

    const results = await request(app)
      .get(`/entities/${encodeURIComponent(entityRef)}/results`)
      .expect(200);
    expect(results.body).toEqual([
      expect.objectContaining({ checkId: 'readme-exists', status: 'exempt' }),
    ]);
  });

  it('denies granting an exemption when the permission check fails, without granting it', async () => {
    const { app } = await createApp({
      permissionsResult: AuthorizeResult.DENY,
    });
    const response = await request(app).post('/exemptions').send({
      checkId: 'readme-exists',
      entityRef: 'component:default/foo',
      reason: 'nope',
    });
    expect(response.status).toEqual(403);

    const listed = await request(app).get('/exemptions').expect(200);
    expect(listed.body).toHaveLength(0);
  });
});

describe('createRouter checks/tracks/campaigns write, export and import', () => {
  it('creates a check, audits the mutation, and rejects malformed input', async () => {
    const { app, events } = await createApp();

    const created = await request(app)
      .post('/checks')
      .send({
        id: 'license-exists',
        name: 'LICENSE exists',
        description: '...',
        factRef: 'scm:default/license',
        rule: { path: '$.exists', operator: 'equal', value: true },
      })
      .expect(201);
    expect(created.body.id).toEqual('license-exists');
    expect(events.publish).toHaveBeenCalledWith({
      topic: 'audit',
      eventPayload: expect.objectContaining({
        action: 'soundcheck.check.write',
        entityRef: 'soundcheck-check:license-exists',
        status: 'succeeded',
      }),
    });

    await request(app)
      .post('/checks')
      .send({ id: 'missing-fields' })
      .expect(400);

    const listed = await request(app).get('/checks').expect(200);
    expect(listed.body).toHaveLength(2);
  });

  it('denies creating a check when the permission check fails', async () => {
    const { app } = await createApp({
      permissionsResult: AuthorizeResult.DENY,
    });
    const response = await request(app)
      .post('/checks')
      .send({
        id: 'license-exists',
        name: 'LICENSE exists',
        description: '...',
        factRef: 'scm:default/license',
        rule: { path: '$.exists', operator: 'equal', value: true },
      });
    expect(response.status).toEqual(403);

    const listed = await request(app).get('/checks').expect(200);
    expect(listed.body).toHaveLength(1);
  });

  it('exports all checks and a single check as YAML', async () => {
    const { app } = await createApp();

    const all = await request(app).get('/checks/export').expect(200);
    expect(all.header['content-type']).toContain('application/yaml');
    expect(all.text).toContain('readme-exists');

    const single = await request(app)
      .get('/checks/readme-exists/export')
      .expect(200);
    expect(single.text).toContain('README exists');

    await request(app).get('/checks/does-not-exist/export').expect(404);
  });

  it('imports checks from YAML, skipping duplicates and reporting the failure', async () => {
    const { app, events } = await createApp();

    const yamlBody = [
      '- id: readme-exists',
      '  name: duplicate',
      '  description: dup',
      '  factRef: scm:default/readme',
      '  rule: { path: "$.exists", operator: equal, value: true }',
      '- id: contributing-exists',
      '  name: CONTRIBUTING exists',
      '  description: ...',
      '  factRef: scm:default/contributing',
      '  rule: { path: "$.exists", operator: equal, value: true }',
    ].join('\n');

    const response = await request(app)
      .post('/checks/import')
      .set('Content-Type', 'text/yaml')
      .send(yamlBody)
      .expect(201);

    expect(response.body.created).toEqual([
      expect.objectContaining({ id: 'contributing-exists' }),
    ]);
    expect(response.body.skipped).toEqual([
      expect.objectContaining({ id: 'readme-exists', reason: 'duplicate id' }),
    ]);
    expect(events.publish).toHaveBeenCalledWith({
      topic: 'audit',
      eventPayload: expect.objectContaining({
        action: 'soundcheck.check.import',
      }),
    });

    const listed = await request(app).get('/checks').expect(200);
    expect(listed.body).toHaveLength(2);
  });

  it('creates a track and a campaign, and exports each collection as YAML', async () => {
    const { app } = await createApp();

    await request(app)
      .post('/tracks')
      .send({
        id: 'basic-track',
        name: 'Basic',
        description: '...',
        levels: [{ name: 'Bronze', rank: 1, checks: ['readme-exists'] }],
      })
      .expect(201);

    await request(app)
      .post('/campaigns')
      .send({
        id: 'q1-push',
        name: 'Q1 push',
        description: '...',
        trackId: 'basic-track',
        targetLevel: 'Bronze',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      })
      .expect(201);

    const tracks = await request(app).get('/tracks/export').expect(200);
    expect(tracks.text).toContain('basic-track');

    const campaigns = await request(app).get('/campaigns/export').expect(200);
    expect(campaigns.text).toContain('q1-push');
  });

  it('exports evaluated entity results for a check as CSV, applying a status filter', async () => {
    const { app, store } = await createApp();
    const entityRef = 'component:default/foo';
    await store.upsertFact({
      factRef: 'scm:default/readme',
      entityRef,
      data: { exists: true },
      collectedAt: new Date().toISOString(),
    });
    await request(app)
      .post(`/entities/${encodeURIComponent(entityRef)}/evaluate`)
      .expect(200);

    const csv = await request(app)
      .get('/checks/readme-exists/entities/csv')
      .expect(200);
    expect(csv.header['content-type']).toContain('text/csv');
    expect(csv.text).toContain('entityRef,status,message,evaluatedAt');
    expect(csv.text).toContain(entityRef);

    const filtered = await request(app)
      .get('/checks/readme-exists/entities/csv')
      .query({ status: 'fail' })
      .expect(200);
    expect(filtered.text.split('\n')).toHaveLength(1);
  });
});
