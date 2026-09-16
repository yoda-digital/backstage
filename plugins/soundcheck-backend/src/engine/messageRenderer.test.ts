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

import { Entity } from '@backstage/catalog-model';
import { renderMessage } from './messageRenderer';

describe('renderMessage', () => {
  const entity: Entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'my-service', namespace: 'default' },
  };

  it('renders entity fields', async () => {
    await expect(
      renderMessage('Entity: {{ entity.metadata.name }}', { entity }),
    ).resolves.toEqual('Entity: my-service');
  });

  it('renders single fact fields', async () => {
    await expect(
      renderMessage('README exists: {{ fact.exists }}', {
        fact: { exists: true },
      }),
    ).resolves.toEqual('README exists: true');
  });

  it('renders multi-fact access via facts[...]', async () => {
    await expect(
      renderMessage("Status: {{ facts['ci:default/pipeline'].status }}", {
        facts: { 'ci:default/pipeline': { status: 'success' } },
      }),
    ).resolves.toEqual('Status: success');
  });

  it('renders the json filter with an indent argument', async () => {
    const rendered = await renderMessage('{{ fact | json: 2 }}', {
      fact: { a: 1 },
    });
    expect(rendered).toEqual(JSON.stringify({ a: 1 }, undefined, 2));
  });

  it('renders the json filter without an indent argument', async () => {
    const rendered = await renderMessage('{{ fact | json }}', {
      fact: { a: 1 },
    });
    expect(rendered).toEqual(JSON.stringify({ a: 1 }));
  });
});
