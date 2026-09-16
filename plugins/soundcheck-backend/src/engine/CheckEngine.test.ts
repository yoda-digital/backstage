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
import {
  SoundcheckCheck,
  SoundcheckFact,
} from '@backstage/plugin-soundcheck-common';
import { CheckEngine } from './CheckEngine';

describe('CheckEngine', () => {
  const engine = new CheckEngine();
  const entityRef = 'component:default/my-service';

  function fact(
    factRef: string,
    data: Record<string, unknown>,
  ): SoundcheckFact {
    return { factRef, entityRef, data, collectedAt: '2026-01-01T00:00:00Z' };
  }

  it('returns unknown when the referenced fact is missing', async () => {
    const check: SoundcheckCheck = {
      id: 'readme-exists',
      name: 'README exists',
      description: '...',
      factRef: 'scm:default/readme',
      rule: { path: '$.exists', operator: 'equal', value: true },
    };

    const result = await engine.evaluate(check, entityRef, []);
    expect(result.status).toEqual('unknown');
    expect(result.message).toMatch(/No fact found/);
  });

  it('passes a simple leaf rule using the default jsonpath resolver', async () => {
    const check: SoundcheckCheck = {
      id: 'readme-exists',
      name: 'README exists',
      description: '...',
      factRef: 'scm:default/readme',
      rule: { path: '$.exists', operator: 'equal', value: true },
    };

    const result = await engine.evaluate(check, entityRef, [
      fact('scm:default/readme', { exists: true }),
    ]);
    expect(result.status).toEqual('pass');
  });

  it('fails a simple leaf rule when the operator does not match', async () => {
    const check: SoundcheckCheck = {
      id: 'readme-exists',
      name: 'README exists',
      description: '...',
      factRef: 'scm:default/readme',
      rule: { path: '$.exists', operator: 'equal', value: true },
    };

    const result = await engine.evaluate(check, entityRef, [
      fact('scm:default/readme', { exists: false }),
    ]);
    expect(result.status).toEqual('fail');
    expect(result.message).toMatch(/did not satisfy equal/);
  });

  it('supports the legacy "field" leaf property', async () => {
    const check: SoundcheckCheck = {
      id: 'legacy',
      name: 'Legacy field rule',
      description: '...',
      factRef: 'legacy:default/fact',
      rule: { field: 'status', operator: 'equal', value: 'ok' },
    };

    const result = await engine.evaluate(check, entityRef, [
      fact('legacy:default/fact', { status: 'ok' }),
    ]);
    expect(result.status).toEqual('pass');
  });

  it('evaluates nested all/any/not combinators across multiple facts', async () => {
    const check: SoundcheckCheck = {
      id: 'multi-fact',
      name: 'Multi fact check',
      description: '...',
      factRef: 'scm:default/readme',
      rule: {
        all: [
          { path: '$.exists', operator: 'equal', value: true },
          {
            any: [
              {
                factRef: 'ci:default/pipeline',
                path: '$.status',
                operator: 'equal',
                value: 'success',
              },
              {
                factRef: 'ci:default/pipeline',
                path: '$.status',
                operator: 'equal',
                value: 'skipped',
              },
            ],
          },
        ],
      },
    };

    const facts = [
      fact('scm:default/readme', { exists: true }),
      fact('ci:default/pipeline', { status: 'skipped' }),
    ];

    const result = await engine.evaluate(check, entityRef, facts);
    expect(result.status).toEqual('pass');
  });

  it('evaluates a "not" combinator', async () => {
    const check: SoundcheckCheck = {
      id: 'not-deprecated',
      name: 'Not deprecated',
      description: '...',
      factRef: 'scm:default/tags',
      rule: {
        not: { path: '$.tags', operator: 'contains', value: 'deprecated' },
      },
    };

    const passing = await engine.evaluate(check, entityRef, [
      fact('scm:default/tags', { tags: ['stable'] }),
    ]);
    expect(passing.status).toEqual('pass');

    const failing = await engine.evaluate(check, entityRef, [
      fact('scm:default/tags', { tags: ['deprecated'] }),
    ]);
    expect(failing.status).toEqual('fail');
  });

  it('resolves paths using the check-level pathResolver', async () => {
    const check: SoundcheckCheck = {
      id: 'jmespath-check',
      name: 'JMESPath check',
      description: '...',
      factRef: 'scm:default/readme',
      pathResolver: 'jmespath',
      rule: { path: 'exists', operator: 'equal', value: true },
    };

    const result = await engine.evaluate(check, entityRef, [
      fact('scm:default/readme', { exists: true }),
    ]);
    expect(result.status).toEqual('pass');
  });

  it('renders Liquid passedMessage/failedMessage templates with entity and fact context', async () => {
    const entity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'my-service', namespace: 'default' },
    };
    const check: SoundcheckCheck = {
      id: 'readme-exists',
      name: 'README exists',
      description: '...',
      factRef: 'scm:default/readme',
      rule: { path: '$.exists', operator: 'equal', value: true },
      passedMessage: '{{ entity.metadata.name }} has a README',
      failedMessage: '{{ entity.metadata.name }} is missing a README',
    };

    const passing = await engine.evaluate(
      check,
      entityRef,
      [fact('scm:default/readme', { exists: true })],
      entity,
    );
    expect(passing.message).toEqual('my-service has a README');

    const failing = await engine.evaluate(
      check,
      entityRef,
      [fact('scm:default/readme', { exists: false })],
      entity,
    );
    expect(failing.message).toEqual('my-service is missing a README');
  });
});
