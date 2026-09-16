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

import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import request from 'supertest';

describe('entity-overlays-backend plugin', () => {
  it('starts up and serves the entity-overlays API', async () => {
    const { server } = await startTestBackend({
      features: [
        import('../src/index'),
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    const getResponse = await request(server).get(
      '/api/entity-overlays/overlays',
    );
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual([]);

    const entityRef = 'component:default/my-service';
    const putResponse = await request(server)
      .put(`/api/entity-overlays/overlays/${encodeURIComponent(entityRef)}`)
      .send({
        patches: [{ path: 'metadata.tags', value: ['test'] }],
      });
    expect(putResponse.status).toBe(200);
    expect(putResponse.body).toMatchObject({ entityRef, patchesApplied: 1 });

    const afterPut = await request(server).get(
      `/api/entity-overlays/overlays/${encodeURIComponent(entityRef)}`,
    );
    expect(afterPut.status).toBe(200);
    expect(afterPut.body).toMatchObject({ entityRef });
  });
});
