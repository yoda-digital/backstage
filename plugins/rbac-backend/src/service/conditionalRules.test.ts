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
  hasAnnotation,
  hasLabel,
  hasTag,
  inSystem,
  isEntityOwner,
} from './conditionalRules';

function entity(overrides: Partial<Entity> = {}): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'my-service',
      namespace: 'default',
      ...overrides.metadata,
    },
    spec: overrides.spec,
    relations: overrides.relations,
  };
}

describe('rbac built-in conditional rules', () => {
  it('IS_ENTITY_OWNER matches on spec.owner or ownedBy relations', () => {
    expect(
      isEntityOwner.apply(entity({ spec: { owner: 'group:default/team-a' } }), {
        claims: ['group:default/team-a'],
      }),
    ).toBe(true);

    expect(
      isEntityOwner.apply(
        entity({
          relations: [{ type: 'ownedBy', targetRef: 'group:default/team-b' }],
        }),
        { claims: ['group:default/team-b'] },
      ),
    ).toBe(true);

    expect(
      isEntityOwner.apply(entity({ spec: { owner: 'group:default/team-a' } }), {
        claims: ['group:default/team-z'],
      }),
    ).toBe(false);
  });

  it('HAS_ANNOTATION matches presence and, optionally, value', () => {
    const withAnnotation = entity({
      metadata: {
        name: 'x',
        annotations: { 'backstage.io/managed-by-location': 'url:foo' },
      },
    });

    expect(
      hasAnnotation.apply(withAnnotation, {
        annotation: 'backstage.io/managed-by-location',
      }),
    ).toBe(true);
    expect(
      hasAnnotation.apply(withAnnotation, {
        annotation: 'backstage.io/managed-by-location',
        value: 'url:foo',
      }),
    ).toBe(true);
    expect(
      hasAnnotation.apply(withAnnotation, {
        annotation: 'backstage.io/managed-by-location',
        value: 'wrong',
      }),
    ).toBe(false);
    expect(hasAnnotation.apply(withAnnotation, { annotation: 'missing' })).toBe(
      false,
    );
  });

  it('HAS_TAG and HAS_LABEL match on the respective entity fields', () => {
    const tagged = entity({ metadata: { name: 'x', tags: ['gold'] } });
    expect(hasTag.apply(tagged, { tag: 'gold' })).toBe(true);
    expect(hasTag.apply(tagged, { tag: 'bronze' })).toBe(false);

    const labeled = entity({
      metadata: { name: 'x', labels: { tier: 'critical' } },
    });
    expect(hasLabel.apply(labeled, { label: 'tier', value: 'critical' })).toBe(
      true,
    );
    expect(hasLabel.apply(labeled, { label: 'tier', value: 'low' })).toBe(
      false,
    );
  });

  it('IN_SYSTEM matches spec.system', () => {
    const inS = entity({ spec: { system: 'payments' } });
    expect(inSystem.apply(inS, { system: 'payments' })).toBe(true);
    expect(inSystem.apply(inS, { system: 'billing' })).toBe(false);
  });
});
