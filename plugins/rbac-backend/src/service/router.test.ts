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
import yaml from 'js-yaml';
import {
  mockErrorHandler,
  mockServices,
  TestDatabases,
} from '@backstage/backend-test-utils';
import { RbacStore } from '../database/RbacStore';
import { createRouter } from './router';

jest.setTimeout(60_000);

const databases = TestDatabases.create({ ids: ['SQLITE_3'] });

async function createApp() {
  const knex = await databases.init('SQLITE_3');
  const database = mockServices.database({
    knex,
    migrations: { skip: false },
  });
  const store = await RbacStore.create({ database });
  const events = mockServices.events.mock();
  const logger = mockServices.logger.mock();
  const httpAuth = mockServices.httpAuth();

  const router = createRouter({ store, httpAuth, logger, events });
  const app = express().use(router).use(mockErrorHandler());
  return { app, store, events };
}

describe('createRouter', () => {
  describe('policy lifecycle endpoints', () => {
    it('creates, lists, retrieves, updates and deletes a draft policy, and audits mutations', async () => {
      const { app, events } = await createApp();

      const created = await request(app)
        .post('/policies')
        .send({ name: 'my-policy' })
        .expect(201);
      expect(created.body).toMatchObject({
        name: 'my-policy',
        status: 'draft',
        strategy: 'first-match',
        rules: [],
      });
      const id = created.body.id;

      expect(events.publish).toHaveBeenCalledWith({
        topic: 'audit',
        eventPayload: expect.objectContaining({
          action: 'rbac.policy.create',
          actor: 'user:default/mock',
          entityRef: `rbac-policy:${id}`,
          status: 'succeeded',
        }),
      });

      const listed = await request(app).get('/policies').expect(200);
      expect(listed.body).toHaveLength(1);

      const fetched = await request(app).get(`/policies/${id}`).expect(200);
      expect(fetched.body).toMatchObject({ id, name: 'my-policy', roles: [] });

      const updated = await request(app)
        .put(`/policies/${id}`)
        .send({
          rules: [{ permission: 'catalog.entity.read', action: 'allow' }],
        })
        .expect(200);
      expect(updated.body.rules).toEqual([
        { permission: 'catalog.entity.read', action: 'allow' },
      ]);

      await request(app).delete(`/policies/${id}`).expect(204);
      await request(app).get(`/policies/${id}`).expect(404);
    });

    it('returns 404 for an unknown policy, and 400 for an invalid create/update body', async () => {
      const { app } = await createApp();

      const missing = await request(app).get('/policies/does-not-exist');
      expect(missing.status).toEqual(404);

      const noName = await request(app).post('/policies').send({});
      expect(noName.status).toEqual(400);

      const badStrategy = await request(app)
        .post('/policies')
        .send({ name: 'bad-strategy', strategy: 'nonsense' });
      expect(badStrategy.status).toEqual(400);

      const created = await request(app)
        .post('/policies')
        .send({ name: 'p' })
        .expect(201);
      const badRules = await request(app)
        .put(`/policies/${created.body.id}`)
        .send({ rules: 'not-an-array' });
      expect(badRules.status).toEqual(400);
    });

    it('publishes a draft, demoting the previously published policy, and rejects updates to non-drafts', async () => {
      const { app, events } = await createApp();

      const first = await request(app)
        .post('/policies')
        .send({ name: 'first' })
        .expect(201);
      const published = await request(app)
        .post(`/policies/${first.body.id}/publish`)
        .expect(200);
      expect(published.body.status).toEqual('published');
      expect(events.publish).toHaveBeenCalledWith({
        topic: 'audit',
        eventPayload: expect.objectContaining({
          action: 'rbac.policy.publish',
          entityRef: `rbac-policy:${first.body.id}`,
        }),
      });

      // A published policy is read-only.
      await request(app)
        .put(`/policies/${first.body.id}`)
        .send({ name: 'renamed' })
        .expect(409);
      await request(app).delete(`/policies/${first.body.id}`).expect(409);

      const second = await request(app)
        .post('/policies')
        .send({ name: 'second' })
        .expect(201);
      await request(app)
        .post(`/policies/${second.body.id}/publish`)
        .expect(200);

      const firstAfter = await request(app)
        .get(`/policies/${first.body.id}`)
        .expect(200);
      expect(firstAfter.body.status).toEqual('inactive');

      const republished = await request(app)
        .post(`/policies/${first.body.id}/republish`)
        .expect(201);
      expect(republished.body.status).toEqual('draft');
      expect(republished.body.id).not.toEqual(first.body.id);
      expect(events.publish).toHaveBeenCalledWith({
        topic: 'audit',
        eventPayload: expect.objectContaining({
          action: 'rbac.policy.republish',
        }),
      });

      // Only inactive policies may be republished.
      await request(app)
        .post(`/policies/${second.body.id}/republish`)
        .expect(409);
    });
  });

  describe('policy tester', () => {
    it('evaluates first-match: a policy-level deny beats a role-level allow', async () => {
      const { app, store } = await createApp();

      const policy = await store.createPolicy({
        name: 'test-policy',
        rules: [{ permission: 'catalog.entity.delete', action: 'deny' }],
      });
      await store.createRole({
        name: 'viewer',
        description: '',
        permissions: [{ permission: 'catalog.entity.delete', action: 'allow' }],
        metadata: {},
      });
      await store.addBinding('viewer', {
        kind: 'user',
        name: 'alice',
        namespace: 'default',
      });

      const response = await request(app)
        .post(`/policies/${policy.id}/test`)
        .send({
          userRef: 'user:default/alice',
          permission: 'catalog.entity.delete',
          resourceRef: 'component:default/my-service',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        decision: 'DENY',
        matchedRule: { permission: 'catalog.entity.delete', action: 'deny' },
        resourceRef: 'component:default/my-service',
      });
      expect(response.body.matchedRole).toBeUndefined();
      expect(Array.isArray(response.body.evaluationChain)).toBe(true);
      expect(response.body.evaluationChain.length).toBeGreaterThan(0);
    });

    it('evaluates any-allow: an unconditioned allow from any role wins', async () => {
      const { app, store } = await createApp();

      const policy = await store.createPolicy({
        name: 'any-allow-policy',
        strategy: 'any-allow',
      });
      await store.createRole({
        name: 'denier',
        description: '',
        permissions: [{ permission: 'catalog.entity.read', action: 'deny' }],
        metadata: {},
      });
      await store.createRole({
        name: 'allower',
        description: '',
        permissions: [{ permission: 'catalog.entity.read', action: 'allow' }],
        metadata: {},
      });
      await store.addBinding('denier', {
        kind: 'user',
        name: 'bob',
        namespace: 'default',
      });
      await store.addBinding('allower', {
        kind: 'user',
        name: 'bob',
        namespace: 'default',
      });

      const response = await request(app)
        .post(`/policies/${policy.id}/test`)
        .send({
          userRef: 'user:default/bob',
          permission: 'catalog.entity.read',
        })
        .expect(200);

      expect(response.body.decision).toEqual('ALLOW');
      expect(response.body.matchedRole).toEqual('allower');
    });

    it('reports CONDITIONAL for a matching conditional rule, and DENY when nothing matches', async () => {
      const { app, store } = await createApp();

      const policy = await store.createPolicy({
        name: 'conditional-policy',
        rules: [
          {
            permission: 'catalog.entity.delete',
            action: 'allow',
            conditions: [{ rule: 'IS_ENTITY_OWNER', params: {} }],
          },
        ],
      });

      const conditional = await request(app)
        .post(`/policies/${policy.id}/test`)
        .send({
          userRef: 'user:default/alice',
          permission: 'catalog.entity.delete',
        })
        .expect(200);
      expect(conditional.body.decision).toEqual('CONDITIONAL');

      const denied = await request(app)
        .post(`/policies/${policy.id}/test`)
        .send({
          userRef: 'user:default/alice',
          permission: 'catalog.entity.read',
        })
        .expect(200);
      expect(denied.body.decision).toEqual('DENY');
      expect(denied.body.matchedRule).toBeUndefined();
    });

    it('requires userRef and permission, and 404s for an unknown policy', async () => {
      const { app, store } = await createApp();
      const policy = await store.createPolicy({ name: 'p' });

      const noUserRef = await request(app)
        .post(`/policies/${policy.id}/test`)
        .send({ permission: 'catalog.entity.read' });
      expect(noUserRef.status).toEqual(400);

      const noPermission = await request(app)
        .post(`/policies/${policy.id}/test`)
        .send({ userRef: 'user:default/alice' });
      expect(noPermission.status).toEqual(400);

      const unknownPolicy = await request(app)
        .post('/policies/does-not-exist/test')
        .send({
          userRef: 'user:default/alice',
          permission: 'catalog.entity.read',
        });
      expect(unknownPolicy.status).toEqual(404);
    });
  });

  describe('YAML import/export', () => {
    it('exports a policy with its scoped roles and bindings as YAML', async () => {
      const { app, store } = await createApp();

      const policy = await store.createPolicy({
        name: 'export-me',
        rules: [{ permission: 'catalog.entity.read', action: 'allow' }],
      });
      await store.createRole({
        name: 'exported-role',
        description: 'a role',
        permissions: [{ permission: 'catalog.entity.read', action: 'allow' }],
        metadata: {},
        policyId: policy.id,
      });
      await store.addBinding('exported-role', {
        kind: 'user',
        name: 'alice',
        namespace: 'default',
      });

      const response = await request(app)
        .get(`/policies/${policy.id}/export`)
        .expect(200);
      expect(response.header['content-type']).toMatch(/application\/x-yaml/);

      const document = yaml.load(response.text) as Record<string, unknown>;
      expect(document).toMatchObject({
        name: 'export-me',
        strategy: 'first-match',
        rules: [{ permission: 'catalog.entity.read', action: 'allow' }],
      });
      expect(document.roles).toEqual([
        expect.objectContaining({ name: 'exported-role' }),
      ]);
      expect(document.bindings).toEqual([
        expect.objectContaining({ role: 'exported-role' }),
      ]);
    });

    it('imports a YAML document as a new draft policy, and rejects invalid documents', async () => {
      const { app, events } = await createApp();

      const yamlDocument = yaml.dump({
        name: 'imported-policy',
        strategy: 'any-allow',
        rules: [{ permission: 'catalog.entity.read', action: 'allow' }],
      });

      const response = await request(app)
        .post('/policies/import')
        .set('Content-Type', 'application/x-yaml')
        .send(yamlDocument)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'imported-policy',
        status: 'draft',
        strategy: 'any-allow',
        rules: [{ permission: 'catalog.entity.read', action: 'allow' }],
      });
      expect(events.publish).toHaveBeenCalledWith({
        topic: 'audit',
        eventPayload: expect.objectContaining({ action: 'rbac.policy.import' }),
      });

      await request(app)
        .post('/policies/import')
        .set('Content-Type', 'application/x-yaml')
        .send('key: [unterminated, flow, sequence')
        .expect(400);

      await request(app)
        .post('/policies/import')
        .set('Content-Type', 'text/yaml')
        .send(yaml.dump({ strategy: 'first-match' }))
        .expect(400);
    });
  });
});
