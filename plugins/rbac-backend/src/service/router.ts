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
import Router from 'express-promise-router';
import type {
  HttpAuthService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { ConflictError, InputError, NotFoundError } from '@backstage/errors';
import type { AuditEvent } from '@backstage/plugin-audit-log-common';
import type { EventsService } from '@backstage/plugin-events-node';
import type {
  RbacPolicyRecord,
  RbacPolicyRule,
  RbacPolicyStrategy,
} from '@backstage/plugin-rbac-common';
import yaml from 'js-yaml';
import { v4 as uuid } from 'uuid';
import type { RbacStore } from '../database/RbacStore';

/** @internal */
export interface RouterOptions {
  store: RbacStore;
  httpAuth: HttpAuthService;
  logger: LoggerService;
  events: EventsService;
}

const VALID_STRATEGIES: RbacPolicyStrategy[] = ['first-match', 'any-allow'];

/**
 * Validates an (optional) resolution strategy value coming from a request
 * body, throwing an `InputError` if it is present but not recognized.
 */
function assertValidStrategy(
  strategy: unknown,
): asserts strategy is RbacPolicyStrategy | undefined {
  if (
    strategy !== undefined &&
    !VALID_STRATEGIES.includes(strategy as RbacPolicyStrategy)
  ) {
    throw new InputError(
      `strategy must be one of ${VALID_STRATEGIES.join(', ')}`,
    );
  }
}

/**
 * Validates an (optional) list of policy rules coming from a request body,
 * throwing an `InputError` if any entry is malformed.
 */
function assertValidRules(
  rules: unknown,
): asserts rules is RbacPolicyRule[] | undefined {
  if (rules === undefined) {
    return;
  }
  if (!Array.isArray(rules)) {
    throw new InputError('rules must be an array');
  }
  for (const rule of rules as Array<Record<string, unknown>>) {
    if (
      typeof rule !== 'object' ||
      rule === null ||
      typeof rule.permission !== 'string' ||
      (rule.action !== 'allow' && rule.action !== 'deny')
    ) {
      throw new InputError(
        "each rule must have a string 'permission' and an action of 'allow' or 'deny'",
      );
    }
    if (rule.conditions !== undefined && !Array.isArray(rule.conditions)) {
      throw new InputError("rule 'conditions' must be an array when present");
    }
  }
}

/**
 * Extracts the caller's user entity ref from resolved credentials, for use
 * as the actor of an audit event.
 */
function getUserRef(credentials: { principal: unknown }): string {
  const principal = credentials.principal as { userEntityRef?: string };
  return principal.userEntityRef ?? 'unknown';
}

/**
 * Publishes an audit event to the `audit` topic, following the
 * {@link AuditEvent} shape consumed by the audit-log backend.
 */
async function publishAudit(
  events: EventsService,
  event: {
    action: string;
    actor: string;
    entityRef?: string;
    metadata?: Record<string, unknown>;
    status?: AuditEvent['status'];
    severity?: AuditEvent['severity'];
  },
): Promise<void> {
  const payload: AuditEvent = {
    id: uuid(),
    action: event.action,
    actor: event.actor,
    entityRef: event.entityRef,
    metadata: event.metadata,
    timestamp: new Date().toISOString(),
    status: event.status ?? 'succeeded',
    severity: event.severity ?? 'low',
    pluginId: 'rbac',
  };
  await events.publish({ topic: 'audit', eventPayload: payload });
}

/**
 * Splits an entity ref of the form `kind:namespace/name` into its parts,
 * defaulting the kind to `user` and the namespace to `default` when absent.
 * Mirrors the equivalent private helper in {@link RbacPermissionPolicy}.
 */
function parseEntityRef(ref: string): {
  kind: string;
  name: string;
  namespace: string;
} {
  const colonIndex = ref.indexOf(':');
  const kind = colonIndex >= 0 ? ref.substring(0, colonIndex) : 'user';
  const rest = colonIndex >= 0 ? ref.substring(colonIndex + 1) : ref;
  const slashIndex = rest.indexOf('/');
  const namespace = slashIndex >= 0 ? rest.substring(0, slashIndex) : 'default';
  const name = slashIndex >= 0 ? rest.substring(slashIndex + 1) : rest;
  return { kind, name, namespace };
}

/**
 * A named group of ordered rules considered while testing a policy: either
 * the policy's own rules, or the permissions of a role bound to the tested
 * subject and visible under that policy. Mirrors the equivalent type in
 * {@link RbacPermissionPolicy}, but is evaluated against an arbitrary
 * (not necessarily published) policy.
 */
interface RuleSource {
  readonly name: string;
  readonly roleName?: string;
  readonly rules: RbacPolicyRule[];
}

/** A single rule considered while testing a policy, and its outcome. */
interface PolicyTestChainEntry {
  readonly source: string;
  readonly rule: RbacPolicyRule;
  readonly matched: boolean;
  readonly decision?: 'ALLOW' | 'DENY' | 'CONDITIONAL';
}

/** The result of testing a policy against a simulated request. */
interface PolicyTestResult {
  readonly decision: 'ALLOW' | 'DENY' | 'CONDITIONAL';
  readonly matchedRole?: string;
  readonly matchedRule?: RbacPolicyRule;
  readonly evaluationChain: PolicyTestChainEntry[];
}

function matchesPermission(rule: RbacPolicyRule, permission: string): boolean {
  return rule.permission === '*' || rule.permission === permission;
}

function ruleDecision(rule: RbacPolicyRule): 'ALLOW' | 'DENY' | 'CONDITIONAL' {
  if (rule.conditions?.length) {
    // The tester has no resource loaded to evaluate the condition against,
    // so (as with the live policy) a conditional rule is reported as
    // CONDITIONAL rather than resolved to a final allow/deny.
    return 'CONDITIONAL';
  }
  return rule.action === 'allow' ? 'ALLOW' : 'DENY';
}

async function buildRuleSources(
  store: RbacStore,
  policy: RbacPolicyRecord,
  userRef: string,
): Promise<RuleSource[]> {
  const sources: RuleSource[] = [];
  if (policy.rules.length > 0) {
    sources.push({ name: `policy:${policy.name}`, rules: policy.rules });
  }

  const ref = parseEntityRef(userRef);
  const roleNames = await store.getRolesForSubject(
    ref.kind,
    ref.name,
    ref.namespace,
  );
  const roles = await store.listRolesForPolicy(roleNames, policy.id);
  for (const role of [...roles].sort((a, b) => a.name.localeCompare(b.name))) {
    sources.push({
      name: `role:${role.name}`,
      roleName: role.name,
      rules: role.permissions,
    });
  }
  return sources;
}

/**
 * First-Match: sources are scanned in order, and the first rule matching
 * the requested permission wins, whatever it decides.
 */
function testFirstMatch(
  sources: RuleSource[],
  permission: string,
): PolicyTestResult {
  const evaluationChain: PolicyTestChainEntry[] = [];
  for (const source of sources) {
    for (const rule of source.rules) {
      const matched = matchesPermission(rule, permission);
      if (!matched) {
        evaluationChain.push({ source: source.name, rule, matched: false });
        continue;
      }
      const decision = ruleDecision(rule);
      evaluationChain.push({
        source: source.name,
        rule,
        matched: true,
        decision,
      });
      return {
        decision,
        matchedRole: source.roleName,
        matchedRule: rule,
        evaluationChain,
      };
    }
  }
  return { decision: 'DENY', evaluationChain };
}

/**
 * Any-Allow: only `allow` rules participate; the request is allowed as soon
 * as an unconditioned matching allow is found, is conditional if only
 * conditioned allows matched, and is denied otherwise. Matches the
 * short-circuiting behavior of `RbacPermissionPolicy`'s any-allow strategy.
 */
function testAnyAllow(
  sources: RuleSource[],
  permission: string,
): PolicyTestResult {
  const evaluationChain: PolicyTestChainEntry[] = [];
  let firstConditional:
    | { source: RuleSource; rule: RbacPolicyRule }
    | undefined;

  for (const source of sources) {
    for (const rule of source.rules) {
      if (rule.action !== 'allow') {
        continue;
      }
      const matched = matchesPermission(rule, permission);
      if (!matched) {
        evaluationChain.push({ source: source.name, rule, matched: false });
        continue;
      }
      const decision = ruleDecision(rule);
      evaluationChain.push({
        source: source.name,
        rule,
        matched: true,
        decision,
      });
      if (decision === 'ALLOW') {
        return {
          decision: 'ALLOW',
          matchedRole: source.roleName,
          matchedRule: rule,
          evaluationChain,
        };
      }
      firstConditional ??= { source, rule };
    }
  }

  if (!firstConditional) {
    return { decision: 'DENY', evaluationChain };
  }
  return {
    decision: 'CONDITIONAL',
    matchedRole: firstConditional.source.roleName,
    matchedRule: firstConditional.rule,
    evaluationChain,
  };
}

async function evaluatePolicyTest(
  store: RbacStore,
  policy: RbacPolicyRecord,
  userRef: string,
  permission: string,
): Promise<PolicyTestResult> {
  const sources = await buildRuleSources(store, policy, userRef);
  return policy.strategy === 'any-allow'
    ? testAnyAllow(sources, permission)
    : testFirstMatch(sources, permission);
}

/** The shape expected of an imported policy YAML document. */
interface PolicyImportDocument {
  readonly name: string;
  readonly strategy?: RbacPolicyStrategy;
  readonly rules?: RbacPolicyRule[];
}

function parsePolicyDocument(raw: string): PolicyImportDocument {
  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (e) {
    throw new InputError(
      `Invalid YAML: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new InputError(
      'YAML document must be a mapping with at least a policy name',
    );
  }
  const { name, strategy, rules } = parsed as Record<string, unknown>;
  if (typeof name !== 'string' || name.length === 0) {
    throw new InputError("YAML document must have a non-empty string 'name'");
  }
  assertValidStrategy(strategy);
  assertValidRules(rules);
  return { name, strategy, rules };
}

/** @internal */
export function createRouter(options: RouterOptions) {
  const { store, httpAuth, logger, events } = options;
  const router = Router();
  router.use(express.json());

  router.get('/roles', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const roles = await store.listRoles();
    res.json(roles);
  });

  router.get('/roles/:name', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const role = await store.getRole(req.params.name);
    if (!role) {
      throw new NotFoundError(`Role '${req.params.name}' not found`);
    }
    res.json(role);
  });

  router.post('/roles', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const { name, description, permissions } = req.body;
    if (!name) {
      throw new InputError('name is required');
    }
    await store.createRole({
      name,
      description: description ?? '',
      permissions: permissions ?? [],
      metadata: {},
    });
    logger.info(`Created RBAC role '${name}'`);
    res.status(201).json({ name });
  });

  router.put('/roles/:name', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const existing = await store.getRole(req.params.name);
    if (!existing) {
      throw new NotFoundError(`Role '${req.params.name}' not found`);
    }
    await store.updateRole(req.params.name, req.body);
    logger.info(`Updated RBAC role '${req.params.name}'`);
    res.status(200).json({ updated: true });
  });

  router.delete('/roles/:name', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    await store.deleteRole(req.params.name);
    logger.info(`Deleted RBAC role '${req.params.name}'`);
    res.status(204).end();
  });

  router.get('/bindings', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const role = req.query.role as string | undefined;
    const bindings = await store.listBindings(role);
    res.json(bindings);
  });

  router.post('/bindings', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const { role, subject } = req.body;
    if (!role || !subject) {
      throw new InputError('role and subject are required');
    }
    await store.addBinding(role, subject);
    logger.info(
      `Bound ${subject.kind}:${subject.namespace ?? 'default'}/${
        subject.name
      } to role '${role}'`,
    );
    res.status(201).json({ created: true });
  });

  router.delete('/bindings', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const { role, subject } = req.body;
    if (!role || !subject) {
      throw new InputError('role and subject are required');
    }
    await store.removeBinding(role, subject);
    res.status(204).end();
  });

  router.get('/policies', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    res.json(await store.listPolicies());
  });

  router.post('/policies', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const { name, strategy } = req.body ?? {};
    if (typeof name !== 'string' || name.length === 0) {
      throw new InputError('name is required');
    }
    assertValidStrategy(strategy);
    const policy = await store.createPolicy({ name, strategy });
    logger.info(`Created RBAC policy '${policy.id}' ('${policy.name}')`);
    await publishAudit(events, {
      action: 'rbac.policy.create',
      actor: getUserRef(credentials),
      entityRef: `rbac-policy:${policy.id}`,
      metadata: { name: policy.name, strategy: policy.strategy },
    });
    res.status(201).json(policy);
  });

  router.post(
    '/policies/import',
    express.text({
      type: ['text/yaml', 'application/x-yaml', 'text/plain'],
      limit: '2mb',
    }),
    async (req, res) => {
      const credentials = await httpAuth.credentials(req, { allow: ['user'] });
      const bodyContent = (req.body as { content?: unknown })?.content;
      let raw: string | undefined;
      if (typeof req.body === 'string') {
        raw = req.body;
      } else if (typeof bodyContent === 'string') {
        raw = bodyContent;
      }
      if (!raw) {
        throw new InputError(
          "Request body must be a YAML document, sent either raw (Content-Type: application/x-yaml or text/yaml) or as JSON { content: '<yaml>' }",
        );
      }
      const document = parsePolicyDocument(raw);
      const policy = await store.createPolicy({
        name: document.name,
        status: 'draft',
        strategy: document.strategy,
        rules: document.rules,
      });
      logger.info(
        `Imported RBAC policy '${policy.id}' ('${policy.name}') from YAML`,
      );
      await publishAudit(events, {
        action: 'rbac.policy.import',
        actor: getUserRef(credentials),
        entityRef: `rbac-policy:${policy.id}`,
        metadata: { name: policy.name },
      });
      res.status(201).json(policy);
    },
  );

  router.get('/policies/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const policy = await store.getPolicy(req.params.id);
    if (!policy) {
      throw new NotFoundError(`Policy '${req.params.id}' not found`);
    }
    const roles = (await store.listRoles()).filter(
      role => role.policyId === policy.id,
    );
    res.json({ ...policy, roles });
  });

  router.put('/policies/:id', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const existing = await store.getPolicy(req.params.id);
    if (!existing) {
      throw new NotFoundError(`Policy '${req.params.id}' not found`);
    }
    if (existing.status !== 'draft') {
      throw new ConflictError(
        `Policy '${req.params.id}' must be a draft to be updated, got '${existing.status}'`,
      );
    }
    const { name, strategy, rules } = req.body ?? {};
    if (name !== undefined && (typeof name !== 'string' || name.length === 0)) {
      throw new InputError('name must be a non-empty string');
    }
    assertValidStrategy(strategy);
    assertValidRules(rules);
    await store.updatePolicy(req.params.id, { name, strategy, rules });
    const updated = await store.getPolicy(req.params.id);
    logger.info(`Updated RBAC policy '${req.params.id}'`);
    await publishAudit(events, {
      action: 'rbac.policy.update',
      actor: getUserRef(credentials),
      entityRef: `rbac-policy:${req.params.id}`,
      metadata: { name: updated?.name },
    });
    res.status(200).json(updated);
  });

  router.delete('/policies/:id', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    await store.deletePolicy(req.params.id);
    logger.info(`Deleted RBAC policy '${req.params.id}'`);
    await publishAudit(events, {
      action: 'rbac.policy.delete',
      actor: getUserRef(credentials),
      entityRef: `rbac-policy:${req.params.id}`,
    });
    res.status(204).end();
  });

  router.post('/policies/:id/publish', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const published = await store.publishPolicy(req.params.id);
    logger.info(`Published RBAC policy '${published.id}'`);
    await publishAudit(events, {
      action: 'rbac.policy.publish',
      actor: getUserRef(credentials),
      entityRef: `rbac-policy:${published.id}`,
      metadata: { name: published.name },
    });
    res.status(200).json(published);
  });

  router.post('/policies/:id/republish', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const republished = await store.republishPolicy(req.params.id);
    logger.info(
      `Republished RBAC policy '${req.params.id}' as new draft '${republished.id}'`,
    );
    await publishAudit(events, {
      action: 'rbac.policy.republish',
      actor: getUserRef(credentials),
      entityRef: `rbac-policy:${republished.id}`,
      metadata: { sourcePolicyId: req.params.id, name: republished.name },
    });
    res.status(201).json(republished);
  });

  router.post('/policies/:id/test', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const policy = await store.getPolicy(req.params.id);
    if (!policy) {
      throw new NotFoundError(`Policy '${req.params.id}' not found`);
    }
    const { userRef, permission, resourceRef } = req.body ?? {};
    if (typeof userRef !== 'string' || userRef.length === 0) {
      throw new InputError('userRef is required');
    }
    if (typeof permission !== 'string' || permission.length === 0) {
      throw new InputError('permission is required');
    }
    const result = await evaluatePolicyTest(store, policy, userRef, permission);
    res.json({
      ...result,
      policyId: policy.id,
      userRef,
      permission,
      resourceRef: typeof resourceRef === 'string' ? resourceRef : undefined,
    });
  });

  router.get('/policies/:id/export', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user', 'service'] });
    const policy = await store.getPolicy(req.params.id);
    if (!policy) {
      throw new NotFoundError(`Policy '${req.params.id}' not found`);
    }
    const roles = (await store.listRoles()).filter(
      role => role.policyId === policy.id,
    );
    const bindings = [];
    for (const role of roles) {
      bindings.push(...(await store.listBindings(role.name)));
    }
    const document = {
      name: policy.name,
      status: policy.status,
      strategy: policy.strategy,
      rules: policy.rules,
      roles: roles.map(role => ({
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        metadata: role.metadata,
      })),
      bindings,
    };
    const content = yaml.dump(document);
    res.setHeader('Content-Type', 'application/x-yaml');
    res.status(200).end(content);
  });

  return router;
}
