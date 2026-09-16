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

import { DateTime } from 'luxon';
import { evaluateOperator } from './operators';

describe('evaluateOperator', () => {
  it('equal', () => {
    expect(evaluateOperator('equal', 'foo', 'foo')).toBe(true);
    expect(evaluateOperator('equal', 'foo', 'bar')).toBe(false);
  });

  it('notEqual', () => {
    expect(evaluateOperator('notEqual', 'foo', 'bar')).toBe(true);
    expect(evaluateOperator('notEqual', 'foo', 'foo')).toBe(false);
  });

  it('greaterThan', () => {
    expect(evaluateOperator('greaterThan', 5, 3)).toBe(true);
    expect(evaluateOperator('greaterThan', 3, 5)).toBe(false);
  });

  it('lessThan', () => {
    expect(evaluateOperator('lessThan', 3, 5)).toBe(true);
    expect(evaluateOperator('lessThan', 5, 3)).toBe(false);
  });

  it('greaterThanOrEqual', () => {
    expect(evaluateOperator('greaterThanOrEqual', 5, 5)).toBe(true);
    expect(evaluateOperator('greaterThanOrEqual', 4, 5)).toBe(false);
  });

  it('lessThanOrEqual', () => {
    expect(evaluateOperator('lessThanOrEqual', 5, 5)).toBe(true);
    expect(evaluateOperator('lessThanOrEqual', 6, 5)).toBe(false);
  });

  it('contains (string and array)', () => {
    expect(evaluateOperator('contains', 'hello world', 'world')).toBe(true);
    expect(evaluateOperator('contains', 'hello world', 'nope')).toBe(false);
    expect(evaluateOperator('contains', ['a', 'b'], 'b')).toBe(true);
    expect(evaluateOperator('contains', ['a', 'b'], 'c')).toBe(false);
  });

  it('notContains', () => {
    expect(evaluateOperator('notContains', 'hello world', 'nope')).toBe(true);
    expect(evaluateOperator('notContains', 'hello world', 'world')).toBe(false);
  });

  it('matches', () => {
    expect(evaluateOperator('matches', 'abc123', '^[a-z]+\\d+$')).toBe(true);
    expect(evaluateOperator('matches', 'ABC', '^[a-z]+$')).toBe(false);
  });

  it('exists', () => {
    expect(evaluateOperator('exists', 'value', undefined)).toBe(true);
    expect(evaluateOperator('exists', undefined, undefined)).toBe(false);
    expect(evaluateOperator('exists', null, undefined)).toBe(false);
  });

  it('notExists', () => {
    expect(evaluateOperator('notExists', undefined, undefined)).toBe(true);
    expect(evaluateOperator('notExists', 'value', undefined)).toBe(false);
  });

  it('semverGt', () => {
    expect(evaluateOperator('semverGt', '2.0.0', '1.0.0')).toBe(true);
    expect(evaluateOperator('semverGt', '1.0.0', '2.0.0')).toBe(false);
  });

  it('semverGte', () => {
    expect(evaluateOperator('semverGte', '1.0.0', '1.0.0')).toBe(true);
    expect(evaluateOperator('semverGte', '0.9.0', '1.0.0')).toBe(false);
  });

  it('semverLt', () => {
    expect(evaluateOperator('semverLt', '1.0.0', '2.0.0')).toBe(true);
    expect(evaluateOperator('semverLt', '2.0.0', '1.0.0')).toBe(false);
  });

  it('semverLte', () => {
    expect(evaluateOperator('semverLte', '1.0.0', '1.0.0')).toBe(true);
    expect(evaluateOperator('semverLte', '2.0.0', '1.0.0')).toBe(false);
  });

  it('semverEq', () => {
    expect(evaluateOperator('semverEq', '1.2.3', '1.2.3')).toBe(true);
    expect(evaluateOperator('semverEq', '1.2.3', '1.2.4')).toBe(false);
  });

  it('semverNeq', () => {
    expect(evaluateOperator('semverNeq', '1.2.3', '1.2.4')).toBe(true);
    expect(evaluateOperator('semverNeq', '1.2.3', '1.2.3')).toBe(false);
  });

  it('semverSatisfies', () => {
    expect(evaluateOperator('semverSatisfies', '1.5.0', '^1.0.0')).toBe(true);
    expect(evaluateOperator('semverSatisfies', '2.0.0', '^1.0.0')).toBe(false);
  });

  it('semverGtr', () => {
    expect(evaluateOperator('semverGtr', '2.0.0', '^1.0.0')).toBe(true);
    expect(evaluateOperator('semverGtr', '1.0.0', '^1.0.0')).toBe(false);
  });

  it('semverLtr', () => {
    expect(evaluateOperator('semverLtr', '0.5.0', '^1.0.0')).toBe(true);
    expect(evaluateOperator('semverLtr', '2.0.0', '^1.0.0')).toBe(false);
  });

  it('after', () => {
    const yesterday = DateTime.now().minus({ days: 1 }).toISO() as string;
    expect(evaluateOperator('after', 'now', yesterday)).toBe(true);
    expect(evaluateOperator('after', yesterday, 'now')).toBe(false);
  });

  it('after supports ISO 8601 duration operands (e.g. -P1Y)', () => {
    const twoYearsAgo = DateTime.now().minus({ years: 2 }).toISO() as string;
    expect(evaluateOperator('after', twoYearsAgo, '-P3Y')).toBe(true);
    expect(evaluateOperator('after', twoYearsAgo, '-P1Y')).toBe(false);
  });

  it('before', () => {
    const yesterday = DateTime.now().minus({ days: 1 }).toISO() as string;
    expect(evaluateOperator('before', yesterday, 'now')).toBe(true);
    expect(evaluateOperator('before', 'now', yesterday)).toBe(false);
  });

  it('in', () => {
    expect(evaluateOperator('in', 'b', ['a', 'b', 'c'])).toBe(true);
    expect(evaluateOperator('in', 'z', ['a', 'b', 'c'])).toBe(false);
  });

  it('notIn', () => {
    expect(evaluateOperator('notIn', 'z', ['a', 'b', 'c'])).toBe(true);
    expect(evaluateOperator('notIn', 'b', ['a', 'b', 'c'])).toBe(false);
  });

  it('doesNotContain', () => {
    expect(evaluateOperator('doesNotContain', ['a', 'b'], 'c')).toBe(true);
    expect(evaluateOperator('doesNotContain', ['a', 'b'], 'a')).toBe(false);
  });

  it('hasLengthOf', () => {
    expect(evaluateOperator('hasLengthOf', ['a', 'b', 'c'], 3)).toBe(true);
    expect(evaluateOperator('hasLengthOf', ['a', 'b'], 3)).toBe(false);
    expect(evaluateOperator('hasLengthOf', 'abc', 3)).toBe(true);
  });

  it('unknown base operators are false', () => {
    expect(evaluateOperator('bogus' as never, 1, 1)).toBe(false);
  });

  describe('array prefixes', () => {
    it('all: passes only when every element satisfies the inner operator', () => {
      expect(evaluateOperator('all:greaterThan', [3, 4, 5], 2)).toBe(true);
      expect(evaluateOperator('all:greaterThan', [3, 1, 5], 2)).toBe(false);
    });

    it('any: passes when at least one element satisfies the inner operator', () => {
      expect(evaluateOperator('any:equal', ['a', 'b', 'c'], 'b')).toBe(true);
      expect(evaluateOperator('any:equal', ['a', 'b', 'c'], 'z')).toBe(false);
    });

    it('none: passes when no element satisfies the inner operator', () => {
      expect(evaluateOperator('none:equal', ['a', 'b', 'c'], 'z')).toBe(true);
      expect(evaluateOperator('none:equal', ['a', 'b', 'c'], 'b')).toBe(false);
    });

    it('wraps a non-array fact value as a single-element array', () => {
      expect(evaluateOperator('any:equal', 'solo', 'solo')).toBe(true);
      expect(evaluateOperator('all:equal', 'solo', 'solo')).toBe(true);
    });
  });
});
