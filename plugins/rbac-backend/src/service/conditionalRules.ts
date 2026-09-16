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

import { Entity, RELATION_OWNED_BY } from '@backstage/catalog-model';
import {
  createPermissionResourceRef,
  createPermissionRule,
} from '@backstage/plugin-permission-node';
import { z } from 'zod/v3';

/**
 * The resource type used by all of the built-in RBAC conditional rules.
 * Rules registered against this type operate on catalog entities.
 *
 * @internal
 */
export const RBAC_CATALOG_ENTITY_RESOURCE_TYPE = 'catalog-entity';

/**
 * A minimal query shape produced by {@link PermissionRule.toQuery} for the
 * built-in RBAC conditional rules. RBAC evaluates conditions in-process
 * against an already-loaded entity (see `apply`); `toQuery` is provided so
 * these rules can also be exposed through a permission integration router
 * for other consumers, following the same convention as the equivalent
 * catalog-backend rules.
 *
 * @internal
 */
export interface RbacEntityQuery {
  key: string;
  values?: string[];
}

/**
 * A {@link @backstage/plugin-permission-node#PermissionResourceRef} for
 * catalog entities, scoped to the `rbac` plugin. Used to register the
 * built-in conditional rules below.
 *
 * @internal
 */
export const rbacCatalogEntityResourceRef = createPermissionResourceRef<
  Entity,
  RbacEntityQuery
>().with({
  pluginId: 'rbac',
  resourceType: RBAC_CATALOG_ENTITY_RESOURCE_TYPE,
});

/**
 * Checks whether the requesting user is an owner of the entity.
 *
 * @remarks
 * The set of `claims` (the user's own entity ref plus its
 * `ownershipEntityRefs`) is not something a role author declares; it is
 * injected by {@link RbacPermissionPolicy} at evaluation time, since it
 * depends on the identity of the caller rather than on static role
 * configuration.
 *
 * @internal
 */
export const isEntityOwner = createPermissionRule({
  name: 'IS_ENTITY_OWNER',
  description: "Allow entities owned by one of the user's claims",
  resourceRef: rbacCatalogEntityResourceRef,
  paramsSchema: z.object({
    claims: z
      .array(z.string())
      .describe('Entity refs to match against the entity owner'),
  }),
  apply: (entity, { claims }) => {
    if (claims.length === 0) {
      return false;
    }
    if (
      entity.relations?.some(
        relation =>
          relation.type === RELATION_OWNED_BY &&
          claims.includes(relation.targetRef),
      )
    ) {
      return true;
    }
    const owner = entity.spec?.owner;
    return typeof owner === 'string' && claims.includes(owner);
  },
  toQuery: ({ claims }) => ({
    key: 'relations.ownedBy',
    values: claims,
  }),
});

/**
 * Checks whether the entity has the given annotation, optionally requiring
 * a specific value.
 *
 * @internal
 */
export const hasAnnotation = createPermissionRule({
  name: 'HAS_ANNOTATION',
  description: 'Allow entities with the specified annotation',
  resourceRef: rbacCatalogEntityResourceRef,
  paramsSchema: z.object({
    annotation: z.string().describe('Name of the annotation to match on'),
    value: z
      .string()
      .optional()
      .describe('Value of the annotation to match on'),
  }),
  apply: (entity, { annotation, value }) => {
    const annotations = entity.metadata.annotations;
    if (!annotations || !(annotation in annotations)) {
      return false;
    }
    return value === undefined || annotations[annotation] === value;
  },
  toQuery: ({ annotation, value }) =>
    value === undefined
      ? { key: `metadata.annotations.${annotation}` }
      : { key: `metadata.annotations.${annotation}`, values: [value] },
});

/**
 * Checks whether the entity has the given tag.
 *
 * @internal
 */
export const hasTag = createPermissionRule({
  name: 'HAS_TAG',
  description: 'Allow entities with the specified tag',
  resourceRef: rbacCatalogEntityResourceRef,
  paramsSchema: z.object({
    tag: z.string().describe('Tag to match on'),
  }),
  apply: (entity, { tag }) => Boolean(entity.metadata.tags?.includes(tag)),
  toQuery: ({ tag }) => ({ key: 'metadata.tags', values: [tag] }),
});

/**
 * Checks whether the entity has the given label, optionally requiring a
 * specific value.
 *
 * @internal
 */
export const hasLabel = createPermissionRule({
  name: 'HAS_LABEL',
  description: 'Allow entities with the specified label',
  resourceRef: rbacCatalogEntityResourceRef,
  paramsSchema: z.object({
    label: z.string().describe('Name of the label to match on'),
    value: z.string().optional().describe('Value of the label to match on'),
  }),
  apply: (entity, { label, value }) => {
    const labels = entity.metadata.labels;
    if (!labels || !(label in labels)) {
      return false;
    }
    return value === undefined || labels[label] === value;
  },
  toQuery: ({ label, value }) =>
    value === undefined
      ? { key: `metadata.labels.${label}` }
      : { key: `metadata.labels.${label}`, values: [value] },
});

/**
 * Checks whether the entity belongs to the given system.
 *
 * @internal
 */
export const inSystem = createPermissionRule({
  name: 'IN_SYSTEM',
  description: 'Allow entities that belong to the specified system',
  resourceRef: rbacCatalogEntityResourceRef,
  paramsSchema: z.object({
    system: z.string().describe('Name of the system to match on'),
  }),
  apply: (entity, { system }) => entity.spec?.system === system,
  toQuery: ({ system }) => ({ key: 'spec.system', values: [system] }),
});

/**
 * All built-in RBAC conditional rules, keyed by name for evaluation and
 * exposed as an array for registration with a permission integration
 * router.
 *
 * @internal
 */
export const rbacConditionalRules = [
  isEntityOwner,
  hasAnnotation,
  hasTag,
  hasLabel,
  inSystem,
];

/** @internal */
export const rbacConditionalRulesByName: Record<
  string,
  (typeof rbacConditionalRules)[number]
> = Object.fromEntries(rbacConditionalRules.map(rule => [rule.name, rule]));
