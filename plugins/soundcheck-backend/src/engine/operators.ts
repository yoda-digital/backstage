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

import {
  SoundcheckBaseRuleOperator,
  SoundcheckRuleOperator,
} from '@backstage/plugin-soundcheck-common';
import { DateTime, Duration } from 'luxon';
import semver from 'semver';

const ARRAY_PREFIX_PATTERN = /^(all|any|none):(.+)$/;

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

function toVersion(value: unknown): string {
  return String(value ?? '');
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined || value === null ? [] : [value];
}

/**
 * Resolves an "after"/"before" operand into a {@link DateTime}. Supports the
 * literal `now` keyword as well as signed ISO 8601 durations (e.g. `-P1Y` for
 * "one year ago") relative to the current time, in addition to plain ISO
 * 8601 timestamps.
 */
function toDateTime(value: unknown): DateTime {
  const raw = String(value ?? '');
  if (raw === 'now') {
    return DateTime.now();
  }
  const durationMatch = /^([+-]?)(P.+)$/.exec(raw);
  if (durationMatch) {
    const [, sign, isoDuration] = durationMatch;
    const duration = Duration.fromISO(isoDuration);
    return sign === '-'
      ? DateTime.now().minus(duration)
      : DateTime.now().plus(duration);
  }
  return DateTime.fromISO(raw);
}

/**
 * Evaluates one of the 26 base (non array-prefixed) operators.
 *
 * @internal
 */
function evaluateBaseOperator(
  operator: SoundcheckBaseRuleOperator,
  factValue: unknown,
  ruleValue: unknown,
): boolean {
  switch (operator) {
    case 'equal':
      return factValue === ruleValue;
    case 'notEqual':
      return factValue !== ruleValue;
    case 'greaterThan':
      return toNumber(factValue) > toNumber(ruleValue);
    case 'lessThan':
      return toNumber(factValue) < toNumber(ruleValue);
    case 'greaterThanOrEqual':
      return toNumber(factValue) >= toNumber(ruleValue);
    case 'lessThanOrEqual':
      return toNumber(factValue) <= toNumber(ruleValue);
    case 'contains':
      if (Array.isArray(factValue)) {
        return factValue.includes(ruleValue);
      }
      return String(factValue ?? '').includes(String(ruleValue));
    case 'notContains':
      if (Array.isArray(factValue)) {
        return !factValue.includes(ruleValue);
      }
      return !String(factValue ?? '').includes(String(ruleValue));
    case 'matches':
      return new RegExp(String(ruleValue)).test(String(factValue ?? ''));
    case 'exists':
      return factValue !== undefined && factValue !== null;
    case 'notExists':
      return factValue === undefined || factValue === null;
    case 'semverGt':
      return semver.gt(toVersion(factValue), toVersion(ruleValue), true);
    case 'semverGte':
      return semver.gte(toVersion(factValue), toVersion(ruleValue), true);
    case 'semverLt':
      return semver.lt(toVersion(factValue), toVersion(ruleValue), true);
    case 'semverLte':
      return semver.lte(toVersion(factValue), toVersion(ruleValue), true);
    case 'semverEq':
      return semver.eq(toVersion(factValue), toVersion(ruleValue), true);
    case 'semverNeq':
      return semver.neq(toVersion(factValue), toVersion(ruleValue), true);
    case 'semverSatisfies':
      return semver.satisfies(toVersion(factValue), toVersion(ruleValue), {
        loose: true,
      });
    case 'semverGtr':
      return semver.gtr(toVersion(factValue), toVersion(ruleValue), {
        loose: true,
      });
    case 'semverLtr':
      return semver.ltr(toVersion(factValue), toVersion(ruleValue), {
        loose: true,
      });
    case 'after':
      return toDateTime(factValue) > toDateTime(ruleValue);
    case 'before':
      return toDateTime(factValue) < toDateTime(ruleValue);
    case 'in':
      return toArray(ruleValue).some(candidate => candidate === factValue);
    case 'notIn':
      return !toArray(ruleValue).some(candidate => candidate === factValue);
    case 'doesNotContain':
      return !toArray(factValue).includes(ruleValue);
    case 'hasLengthOf': {
      if (Array.isArray(factValue) || typeof factValue === 'string') {
        return factValue.length === toNumber(ruleValue);
      }
      return false;
    }
    default:
      return false;
  }
}

/**
 * Evaluates a Soundcheck rule operator against a resolved fact value and the
 * rule's configured comparison value.
 *
 * Supports the 26 base operators (equality, numeric comparisons, string and
 * array matching, semver comparisons, and date comparisons), as well as the
 * `all:`, `any:`, and `none:` prefixes, which apply any base operator across
 * every element of an array-valued fact.
 *
 * @public
 */
export function evaluateOperator(
  operator: SoundcheckRuleOperator,
  factValue: unknown,
  ruleValue: unknown,
): boolean {
  const prefixMatch = ARRAY_PREFIX_PATTERN.exec(operator);
  if (!prefixMatch) {
    return evaluateBaseOperator(
      operator as SoundcheckBaseRuleOperator,
      factValue,
      ruleValue,
    );
  }

  const [, mode, inner] = prefixMatch;
  const innerOperator = inner as SoundcheckBaseRuleOperator;
  const items = toArray(factValue);

  switch (mode) {
    case 'all':
      return items.every(item =>
        evaluateBaseOperator(innerOperator, item, ruleValue),
      );
    case 'any':
      return items.some(item =>
        evaluateBaseOperator(innerOperator, item, ruleValue),
      );
    case 'none':
      return !items.some(item =>
        evaluateBaseOperator(innerOperator, item, ruleValue),
      );
    default:
      return false;
  }
}
