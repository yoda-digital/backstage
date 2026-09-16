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
  SoundcheckCheck,
  SoundcheckEntityFilter,
  SoundcheckPathResolver,
  SoundcheckRule,
  SoundcheckRuleCondition,
  SoundcheckRuleOperator,
} from '@backstage/plugin-soundcheck-common';

/**
 * A single leaf condition being edited by the {@link RuleBuilder}. Mirrors
 * {@link SoundcheckRuleCondition} but carries a stable `id` so the wizard can
 * track additions, removals, and reordering without relying on array index.
 */
export interface RuleConditionNode {
  readonly id: string;
  readonly kind: 'condition';
  readonly factRef?: string;
  readonly path: string;
  readonly operator: SoundcheckRuleOperator;
  readonly value?: unknown;
}

/**
 * A boolean combinator group being edited by the {@link RuleBuilder}. `not`
 * groups are constrained to a single child by the UI, matching
 * `SoundcheckRuleNot`.
 */
export interface RuleGroupNode {
  readonly id: string;
  readonly kind: 'all' | 'any' | 'not';
  readonly children: RuleNode[];
}

/**
 * An editable node in the rule tree — either a leaf condition or a nested
 * boolean combinator group.
 */
export type RuleNode = RuleConditionNode | RuleGroupNode;

let nextNodeId = 0;

function createNodeId(): string {
  nextNodeId += 1;
  return `rule-node-${nextNodeId}`;
}

/**
 * Creates a new, empty leaf condition for the rule tree.
 */
export function createConditionNode(
  partial?: Partial<Omit<RuleConditionNode, 'id' | 'kind'>>,
): RuleConditionNode {
  return {
    id: createNodeId(),
    kind: 'condition',
    path: '',
    operator: 'equal',
    value: '',
    ...partial,
  };
}

/**
 * Creates a new boolean combinator group, pre-populated with a single empty
 * condition so the tree always renders something editable.
 */
export function createGroupNode(kind: RuleGroupNode['kind']): RuleGroupNode {
  return {
    id: createNodeId(),
    kind,
    children: [createConditionNode()],
  };
}

/**
 * Converts an editable {@link RuleNode} tree into the {@link SoundcheckRule}
 * shape consumed by the Soundcheck backend.
 */
export function ruleNodeToRule(node: RuleNode): SoundcheckRule {
  // Narrowing on the single-literal `'condition'` discriminant first lets
  // TypeScript fully exclude `RuleConditionNode` from the union below,
  // leaving a plain `RuleGroupNode` (whose `kind` is itself a union of
  // literals, which doesn't narrow as cleanly the other way around).
  if (node.kind === 'condition') {
    const condition: {
      factRef?: string;
      path?: string;
      operator: SoundcheckRuleOperator;
      value?: unknown;
    } = {
      path: node.path,
      operator: node.operator,
    };
    if (node.factRef) {
      condition.factRef = node.factRef;
    }
    if (node.value !== undefined && node.value !== '') {
      condition.value = node.value;
    }
    return condition as SoundcheckRuleCondition;
  }
  if (node.kind === 'all') {
    return { all: node.children.map(ruleNodeToRule) };
  }
  if (node.kind === 'any') {
    return { any: node.children.map(ruleNodeToRule) };
  }
  return { not: ruleNodeToRule(node.children[0] ?? createConditionNode()) };
}

/**
 * Converts a persisted {@link SoundcheckRule} into an editable {@link RuleNode}
 * tree, used to pre-populate the wizard when editing an existing check.
 */
export function ruleToRuleNode(rule: SoundcheckRule): RuleNode {
  if ('all' in rule) {
    return {
      id: createNodeId(),
      kind: 'all',
      children: rule.all.map(ruleToRuleNode),
    };
  }
  if ('any' in rule) {
    return {
      id: createNodeId(),
      kind: 'any',
      children: rule.any.map(ruleToRuleNode),
    };
  }
  if ('not' in rule) {
    return {
      id: createNodeId(),
      kind: 'not',
      children: [ruleToRuleNode(rule.not)],
    };
  }
  return {
    id: createNodeId(),
    kind: 'condition',
    factRef: rule.factRef,
    path: rule.path ?? rule.field ?? '',
    operator: rule.operator,
    value: rule.value,
  };
}

/**
 * The full state edited by the {@link CheckBuilderWizard}. Covers every
 * `SoundcheckCheck` field, plus an editable rule tree and an `excludeFilter`
 * that the wizard preserves for forward compatibility even though the
 * evaluation engine does not act on it yet — see `ReviewAndTest.tsx`.
 */
export interface CheckDraft {
  id?: string;
  name: string;
  description: string;
  factRef: string;
  pathResolver: SoundcheckPathResolver;
  rule: RuleNode;
  filter: SoundcheckEntityFilter;
  excludeFilter: SoundcheckEntityFilter;
  ownerEntityRef: string;
  passedMessage: string;
  failedMessage: string;
}

/**
 * Builds a blank draft for creating a brand new check.
 */
export function createEmptyDraft(): CheckDraft {
  return {
    name: '',
    description: '',
    factRef: '',
    pathResolver: 'jsonpath',
    rule: createGroupNode('all'),
    filter: {},
    excludeFilter: {},
    ownerEntityRef: '',
    passedMessage: '',
    failedMessage: '',
  };
}

/**
 * Builds an editable draft from a persisted check, for the wizard's edit
 * flow. Accepts an optional `excludeFilter` extension field that isn't part
 * of the public `SoundcheckCheck` type yet.
 */
export function draftFromCheck(
  check: SoundcheckCheck & { excludeFilter?: SoundcheckEntityFilter },
): CheckDraft {
  return {
    id: check.id,
    name: check.name,
    description: check.description,
    factRef: check.factRef,
    pathResolver: check.pathResolver ?? 'jsonpath',
    rule: ruleToRuleNode(check.rule),
    filter: check.filter ?? {},
    excludeFilter: check.excludeFilter ?? {},
    ownerEntityRef: check.ownerEntityRef ?? '',
    passedMessage: check.passedMessage ?? '',
    failedMessage: check.failedMessage ?? '',
  };
}

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `check-${Date.now()}`;
}

function isNonEmptyFilter(filter: SoundcheckEntityFilter): boolean {
  return Object.values(filter).some(
    value => Array.isArray(value) && value.length > 0,
  );
}

/**
 * Builds the {@link SoundcheckCheck} payload to send to the backend. The
 * result also carries an `excludeFilter` extension — see
 * {@link CheckDraft.excludeFilter} — which the current REST API and
 * evaluation engine ignore, but which round-trips through drafts so the
 * feature can be wired up on the backend without a frontend change.
 */
export function draftToCheck(
  draft: CheckDraft,
): SoundcheckCheck & { excludeFilter?: SoundcheckEntityFilter } {
  // A mutable shape (SoundcheckCheck's fields are all `readonly`) built up
  // field by field, then handed back as the public, read-only-typed result.
  const check: {
    id: string;
    name: string;
    description: string;
    factRef: string;
    rule: SoundcheckRule;
    pathResolver: SoundcheckPathResolver;
    ownerEntityRef?: string;
    passedMessage?: string;
    failedMessage?: string;
    filter?: SoundcheckEntityFilter;
    excludeFilter?: SoundcheckEntityFilter;
  } = {
    id: draft.id ?? slugify(draft.name),
    name: draft.name,
    description: draft.description,
    factRef: draft.factRef,
    rule: ruleNodeToRule(draft.rule),
    pathResolver: draft.pathResolver,
  };
  if (draft.ownerEntityRef) {
    check.ownerEntityRef = draft.ownerEntityRef;
  }
  if (draft.passedMessage) {
    check.passedMessage = draft.passedMessage;
  }
  if (draft.failedMessage) {
    check.failedMessage = draft.failedMessage;
  }
  if (isNonEmptyFilter(draft.filter)) {
    check.filter = draft.filter;
  }
  if (isNonEmptyFilter(draft.excludeFilter)) {
    check.excludeFilter = draft.excludeFilter;
  }
  return check;
}
