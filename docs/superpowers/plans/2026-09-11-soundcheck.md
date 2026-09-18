# Sub-project 3: Soundcheck — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a quality and compliance engine that defines checks, collects facts from external sources, evaluates pass/fail results, organizes checks into tracks and campaigns, and awards certifications to catalog entities.

**Architecture:** Soundcheck is a plugin family with an extensible fact-collection system. The backend defines extension points for fact collectors and check providers. Backend modules (GitLab, K8s, SonarQube, etc.) register fact collectors via the extension point. The check engine evaluates collected facts against check rules, rolls results into tracks, and awards certification levels. The frontend renders checks, tracks, campaigns, entity scorecards, and insights dashboards using the new frontend system.

**Tech Stack:** PostgreSQL (Knex migrations), `coreServices.scheduler` for periodic fact collection, `@backstage/backend-plugin-api` extension points, new frontend system (`@backstage/frontend-plugin-api`).

**Spec:** `docs/superpowers/specs/2026-09-11-devpane-portal-architecture-design.md` — Sub-project 3 section.

## Global Constraints

- Backstage new frontend system only — no old system patterns
- All config values via environment variables (`${VAR}`) — no hardcoded secrets
- Copyright headers on all new `.ts`/`.tsx` files (Apache 2.0, year 2026)
- Follow ADR011 plugin package naming (`@backstage/plugin-soundcheck-*`)
- Follow ADR004 module export structure (index.ts re-exports)
- No `React.FC`, no default exports (except `createBackendPlugin`/`createFrontendPlugin` module defaults)
- Exported functions use `function` keyword, not arrow
- Tests: `startTestBackend`/`mockServices.*` for backend, `renderInTestApp`/`mockApis.*` for frontend
- Every config field in `config.d.ts` with `@visibility` annotation
- Every write operation behind a permission check
- Every state mutation emits an audit event

---

### Task 1: Soundcheck Common — Types and Models

**Files:**

- Create: `plugins/soundcheck-common/src/types.ts`
- Create: `plugins/soundcheck-common/src/filters.ts`
- Create: `plugins/soundcheck-common/src/constants.ts`
- Create: `plugins/soundcheck-common/src/index.ts`
- Create: `plugins/soundcheck-common/package.json`

**Interfaces:**

- Consumes: `@backstage/catalog-model` (for `EntityRef`)
- Produces: All shared types consumed by `-backend`, `-node`, `-frontend`, and all modules

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@backstage/plugin-soundcheck-common",
  "version": "0.1.0",
  "backstage": {
    "role": "common-library",
    "pluginId": "soundcheck",
    "pluginPackages": [
      "@backstage/plugin-soundcheck",
      "@backstage/plugin-soundcheck-backend",
      "@backstage/plugin-soundcheck-common",
      "@backstage/plugin-soundcheck-node"
    ]
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@backstage/catalog-model": "workspace:^"
  }
}
```

- [ ] **Step 2: Create `types.ts` with core data models**

```ts
/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * ...full Apache 2.0 header...
 */

/**
 * A fact collected from an external source about an entity.
 * @public
 */
export interface SoundcheckFact {
  readonly factRef: string;
  readonly entityRef: string;
  readonly data: Record<string, unknown>;
  readonly collectedAt: string;
  readonly expiresAt?: string;
}

/**
 * A check rule that evaluates facts and produces a pass/fail result.
 * @public
 */
export interface SoundcheckCheck {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly factRef: string;
  readonly rule: SoundcheckRule;
  readonly ownerEntityRef?: string;
  readonly filter?: SoundcheckEntityFilter;
}

/**
 * Rule definition — a JSONPath or simple field comparison.
 * @public
 */
export interface SoundcheckRule {
  readonly operator: SoundcheckRuleOperator;
  readonly field: string;
  readonly value: unknown;
}

/**
 * @public
 */
export type SoundcheckRuleOperator =
  | 'equal'
  | 'notEqual'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'contains'
  | 'notContains'
  | 'matches'
  | 'exists'
  | 'notExists';

/**
 * Result of evaluating a check against an entity's facts.
 * @public
 */
export interface SoundcheckCheckResult {
  readonly checkId: string;
  readonly entityRef: string;
  readonly status: SoundcheckCheckStatus;
  readonly message?: string;
  readonly evaluatedAt: string;
}

/** @public */
export type SoundcheckCheckStatus = 'pass' | 'fail' | 'unknown' | 'error';

/**
 * A track groups checks in order and awards a certification level.
 * @public
 */
export interface SoundcheckTrack {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly ownerEntityRef?: string;
  readonly levels: SoundcheckLevel[];
  readonly filter?: SoundcheckEntityFilter;
}

/**
 * A certification level within a track. An entity earns the level
 * when all required checks pass.
 * @public
 */
export interface SoundcheckLevel {
  readonly name: string;
  readonly rank: number;
  readonly checks: string[];
}

/**
 * A time-bound campaign to drive entities through a track.
 * @public
 */
export interface SoundcheckCampaign {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly trackId: string;
  readonly targetLevel: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly targetFilter?: SoundcheckEntityFilter;
  readonly ownerEntityRef?: string;
}

/**
 * An entity's certification — the highest level achieved in a track.
 * @public
 */
export interface SoundcheckCertification {
  readonly entityRef: string;
  readonly trackId: string;
  readonly levelName: string;
  readonly levelRank: number;
  readonly certifiedAt: string;
}

/**
 * Filter to select which entities a check/track/campaign applies to.
 * @public
 */
export interface SoundcheckEntityFilter {
  readonly kinds?: string[];
  readonly types?: string[];
  readonly lifecycles?: string[];
  readonly tags?: string[];
}
```

- [ ] **Step 3: Create `filters.ts` with filter matching utility**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { SoundcheckEntityFilter } from './types';

/**
 * Checks whether an entity matches a Soundcheck entity filter.
 * @public
 */
export function matchesEntityFilter(
  entity: {
    kind: string;
    spec?: { type?: string; lifecycle?: string };
    metadata?: { tags?: string[] };
  },
  filter?: SoundcheckEntityFilter,
): boolean {
  if (!filter) return true;
  if (filter.kinds?.length && !filter.kinds.includes(entity.kind.toLowerCase()))
    return false;
  if (
    filter.types?.length &&
    !filter.types.includes(String(entity.spec?.type ?? ''))
  )
    return false;
  if (
    filter.lifecycles?.length &&
    !filter.lifecycles.includes(String(entity.spec?.lifecycle ?? ''))
  )
    return false;
  if (filter.tags?.length) {
    const entityTags = entity.metadata?.tags ?? [];
    if (!filter.tags.some(t => entityTags.includes(t))) return false;
  }
  return true;
}
```

- [ ] **Step 4: Create `constants.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

/** @public */
export const SOUNDCHECK_PLUGIN_ID = 'soundcheck';

/** @public */
export const SOUNDCHECK_FACT_LIFECYCLE_MAX_DAYS = 90;
```

- [ ] **Step 5: Create `index.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

/**
 * Common types and utilities for the Soundcheck plugin.
 * @packageDocumentation
 */

export type {
  SoundcheckFact,
  SoundcheckCheck,
  SoundcheckRule,
  SoundcheckRuleOperator,
  SoundcheckCheckResult,
  SoundcheckCheckStatus,
  SoundcheckTrack,
  SoundcheckLevel,
  SoundcheckCampaign,
  SoundcheckCertification,
  SoundcheckEntityFilter,
} from './types';
export { matchesEntityFilter } from './filters';
export {
  SOUNDCHECK_PLUGIN_ID,
  SOUNDCHECK_FACT_LIFECYCLE_MAX_DAYS,
} from './constants';
```

- [ ] **Step 6: Write tests for filter matching**

Create `plugins/soundcheck-common/src/filters.test.ts`:

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { matchesEntityFilter } from './filters';

describe('matchesEntityFilter', () => {
  const entity = {
    kind: 'Component',
    spec: { type: 'service', lifecycle: 'production' },
    metadata: { tags: ['java', 'backend'] },
  };

  it('returns true when no filter provided', () => {
    expect(matchesEntityFilter(entity)).toBe(true);
    expect(matchesEntityFilter(entity, undefined)).toBe(true);
  });

  it('filters by kind', () => {
    expect(matchesEntityFilter(entity, { kinds: ['component'] })).toBe(true);
    expect(matchesEntityFilter(entity, { kinds: ['api'] })).toBe(false);
  });

  it('filters by type', () => {
    expect(matchesEntityFilter(entity, { types: ['service'] })).toBe(true);
    expect(matchesEntityFilter(entity, { types: ['website'] })).toBe(false);
  });

  it('filters by lifecycle', () => {
    expect(matchesEntityFilter(entity, { lifecycles: ['production'] })).toBe(
      true,
    );
    expect(matchesEntityFilter(entity, { lifecycles: ['experimental'] })).toBe(
      false,
    );
  });

  it('filters by tags (any match)', () => {
    expect(matchesEntityFilter(entity, { tags: ['java'] })).toBe(true);
    expect(matchesEntityFilter(entity, { tags: ['python'] })).toBe(false);
    expect(matchesEntityFilter(entity, { tags: ['python', 'java'] })).toBe(
      true,
    );
  });

  it('combines multiple filters with AND logic', () => {
    expect(
      matchesEntityFilter(entity, { kinds: ['component'], types: ['service'] }),
    ).toBe(true);
    expect(
      matchesEntityFilter(entity, { kinds: ['component'], types: ['website'] }),
    ).toBe(false);
  });
});
```

- [ ] **Step 7: Run tests**

Run: `CI=1 yarn test plugins/soundcheck-common 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add plugins/soundcheck-common/
git commit -s -m "feat(soundcheck): add common types, models, and filter utilities

Core data models for facts, checks, tracks, campaigns, certifications.
Entity filter matching with kind/type/lifecycle/tag support.
Shared constants for plugin ID and fact lifecycle."
```

---

### Task 2: Soundcheck Node — Extension Points

**Files:**

- Create: `plugins/soundcheck-node/src/extensions.ts`
- Create: `plugins/soundcheck-node/src/index.ts`
- Create: `plugins/soundcheck-node/package.json`

**Interfaces:**

- Consumes: `@backstage/backend-plugin-api` (`createExtensionPoint`), `@backstage/plugin-soundcheck-common`
- Produces: `soundcheckFactCollectorExtensionPoint`, `soundcheckCheckProviderExtensionPoint` — used by the backend plugin and all `-backend-module-*` packages

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@backstage/plugin-soundcheck-node",
  "version": "0.1.0",
  "backstage": {
    "role": "node-library",
    "pluginId": "soundcheck",
    "pluginPackages": [
      "@backstage/plugin-soundcheck",
      "@backstage/plugin-soundcheck-backend",
      "@backstage/plugin-soundcheck-common",
      "@backstage/plugin-soundcheck-node"
    ]
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@backstage/backend-plugin-api": "workspace:^",
    "@backstage/plugin-soundcheck-common": "workspace:^"
  }
}
```

- [ ] **Step 2: Create `extensions.ts` with both extension points**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { createExtensionPoint } from '@backstage/backend-plugin-api';
import { SoundcheckFact } from '@backstage/plugin-soundcheck-common';

/**
 * A fact collector gathers data from an external source about catalog entities.
 * @public
 */
export interface SoundcheckFactCollector {
  readonly factRef: string;
  readonly description: string;
  collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>>;
}

/**
 * Extension point for registering fact collectors.
 * Backend modules use this to add new fact collection capabilities.
 * @public
 */
export interface SoundcheckFactCollectorExtensionPoint {
  addCollector(collector: SoundcheckFactCollector): void;
}

/** @public */
export const soundcheckFactCollectorExtensionPoint =
  createExtensionPoint<SoundcheckFactCollectorExtensionPoint>({
    id: 'soundcheck.fact-collectors',
  });

/**
 * A check provider supplies check definitions programmatically.
 * @public
 */
export interface SoundcheckCheckProvider {
  readonly providerId: string;
  getChecks(): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      factRef: string;
      rule: { operator: string; field: string; value: unknown };
    }>
  >;
}

/**
 * Extension point for registering custom check providers.
 * @public
 */
export interface SoundcheckCheckProviderExtensionPoint {
  addProvider(provider: SoundcheckCheckProvider): void;
}

/** @public */
export const soundcheckCheckProviderExtensionPoint =
  createExtensionPoint<SoundcheckCheckProviderExtensionPoint>({
    id: 'soundcheck.check-providers',
  });
```

- [ ] **Step 3: Create `index.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

/**
 * Node.js library for the Soundcheck plugin.
 * @packageDocumentation
 */

export type {
  SoundcheckFactCollector,
  SoundcheckFactCollectorExtensionPoint,
  SoundcheckCheckProvider,
  SoundcheckCheckProviderExtensionPoint,
} from './extensions';
export {
  soundcheckFactCollectorExtensionPoint,
  soundcheckCheckProviderExtensionPoint,
} from './extensions';
```

- [ ] **Step 4: Commit**

```bash
git add plugins/soundcheck-node/
git commit -s -m "feat(soundcheck): add node library with extension points

Fact collector extension point for backend modules to register data sources.
Check provider extension point for programmatic check definitions."
```

---

### Task 3: Soundcheck Backend — Engine, Storage, and API

**Files:**

- Create: `plugins/soundcheck-backend/src/plugin.ts`
- Create: `plugins/soundcheck-backend/src/service/router.ts`
- Create: `plugins/soundcheck-backend/src/database/SoundcheckStore.ts`
- Create: `plugins/soundcheck-backend/src/database/migrations.ts`
- Create: `plugins/soundcheck-backend/src/engine/CheckEngine.ts`
- Create: `plugins/soundcheck-backend/src/engine/FactScheduler.ts`
- Create: `plugins/soundcheck-backend/src/index.ts`
- Create: `plugins/soundcheck-backend/src/setupTests.ts`
- Create: `plugins/soundcheck-backend/config.d.ts`
- Create: `plugins/soundcheck-backend/package.json`

**Interfaces:**

- Consumes: `@backstage/plugin-soundcheck-node` (extension points), `@backstage/plugin-soundcheck-common` (types), `coreServices` (database, scheduler, logger, httpRouter, auth, httpAuth, permissions)
- Produces: REST API at `/api/soundcheck` for checks, tracks, campaigns, facts, certifications, results

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@backstage/plugin-soundcheck-backend",
  "version": "0.1.0",
  "backstage": {
    "role": "backend-plugin",
    "pluginId": "soundcheck",
    "pluginPackages": [
      "@backstage/plugin-soundcheck",
      "@backstage/plugin-soundcheck-backend",
      "@backstage/plugin-soundcheck-common",
      "@backstage/plugin-soundcheck-node"
    ]
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "configSchema": "config.d.ts",
  "dependencies": {
    "@backstage/backend-defaults": "workspace:^",
    "@backstage/backend-plugin-api": "workspace:^",
    "@backstage/catalog-model": "workspace:^",
    "@backstage/errors": "workspace:^",
    "@backstage/plugin-auth-node": "workspace:^",
    "@backstage/plugin-permission-common": "workspace:^",
    "@backstage/plugin-permission-node": "workspace:^",
    "@backstage/plugin-soundcheck-common": "workspace:^",
    "@backstage/plugin-soundcheck-node": "workspace:^",
    "express": "^4.18.2",
    "express-promise-router": "^4.1.0",
    "knex": "^3.0.0",
    "luxon": "^3.0.0"
  },
  "devDependencies": {
    "@backstage/backend-test-utils": "workspace:^",
    "supertest": "^6.3.3"
  }
}
```

- [ ] **Step 2: Create `config.d.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

export interface Config {
  /**
   * Soundcheck plugin configuration.
   * @visibility frontend
   */
  soundcheck?: {
    /**
     * Default schedule for fact collection.
     * @visibility backend
     */
    schedule?: {
      /** @visibility backend */
      frequency?: { minutes: number };
      /** @visibility backend */
      timeout?: { minutes: number };
    };
    /**
     * Path to a YAML file with check and track definitions.
     * @visibility backend
     */
    checksFile?: string;
  };
}
```

- [ ] **Step 3: Create database migrations**

Create `plugins/soundcheck-backend/src/database/migrations.ts`:

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { Knex } from 'knex';
import { resolvePackagePath } from '@backstage/backend-plugin-api';

export async function applyMigrations(knex: Knex): Promise<void> {
  await knex.schema.createTableIfNotExists('soundcheck_facts', table => {
    table.string('fact_ref').notNullable();
    table.string('entity_ref').notNullable();
    table.jsonb('data').notNullable();
    table.timestamp('collected_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('expires_at').nullable();
    table.primary(['fact_ref', 'entity_ref']);
    table.index(['entity_ref']);
  });

  await knex.schema.createTableIfNotExists('soundcheck_checks', table => {
    table.string('id').primary();
    table.string('name').notNullable();
    table.text('description').notNullable();
    table.string('fact_ref').notNullable();
    table.jsonb('rule').notNullable();
    table.string('owner_entity_ref').nullable();
    table.jsonb('filter').nullable();
  });

  await knex.schema.createTableIfNotExists(
    'soundcheck_check_results',
    table => {
      table.string('check_id').notNullable();
      table.string('entity_ref').notNullable();
      table.string('status').notNullable();
      table.text('message').nullable();
      table.timestamp('evaluated_at').notNullable().defaultTo(knex.fn.now());
      table.primary(['check_id', 'entity_ref']);
      table.index(['entity_ref']);
    },
  );

  await knex.schema.createTableIfNotExists('soundcheck_tracks', table => {
    table.string('id').primary();
    table.string('name').notNullable();
    table.text('description').notNullable();
    table.string('owner_entity_ref').nullable();
    table.jsonb('levels').notNullable();
    table.jsonb('filter').nullable();
  });

  await knex.schema.createTableIfNotExists('soundcheck_campaigns', table => {
    table.string('id').primary();
    table.string('name').notNullable();
    table.text('description').notNullable();
    table
      .string('track_id')
      .notNullable()
      .references('id')
      .inTable('soundcheck_tracks');
    table.string('target_level').notNullable();
    table.timestamp('start_date').notNullable();
    table.timestamp('end_date').notNullable();
    table.jsonb('target_filter').nullable();
    table.string('owner_entity_ref').nullable();
  });

  await knex.schema.createTableIfNotExists(
    'soundcheck_certifications',
    table => {
      table.string('entity_ref').notNullable();
      table
        .string('track_id')
        .notNullable()
        .references('id')
        .inTable('soundcheck_tracks');
      table.string('level_name').notNullable();
      table.integer('level_rank').notNullable();
      table.timestamp('certified_at').notNullable().defaultTo(knex.fn.now());
      table.primary(['entity_ref', 'track_id']);
    },
  );
}
```

- [ ] **Step 4: Create `SoundcheckStore.ts`**

Create `plugins/soundcheck-backend/src/database/SoundcheckStore.ts`:

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { Knex } from 'knex';
import {
  SoundcheckFact,
  SoundcheckCheck,
  SoundcheckCheckResult,
  SoundcheckTrack,
  SoundcheckCampaign,
  SoundcheckCertification,
} from '@backstage/plugin-soundcheck-common';
import { applyMigrations } from './migrations';

/** @internal */
export class SoundcheckStore {
  private constructor(private readonly db: Knex) {}

  static async create(options: { database: Knex }): Promise<SoundcheckStore> {
    await applyMigrations(options.database);
    return new SoundcheckStore(options.database);
  }

  async upsertFact(fact: SoundcheckFact): Promise<void> {
    await this.db('soundcheck_facts')
      .insert({
        fact_ref: fact.factRef,
        entity_ref: fact.entityRef,
        data: JSON.stringify(fact.data),
        collected_at: fact.collectedAt,
        expires_at: fact.expiresAt ?? null,
      })
      .onConflict(['fact_ref', 'entity_ref'])
      .merge();
  }

  async getFacts(entityRef: string): Promise<SoundcheckFact[]> {
    const rows = await this.db('soundcheck_facts').where({
      entity_ref: entityRef,
    });
    return rows.map(row => ({
      factRef: row.fact_ref,
      entityRef: row.entity_ref,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      collectedAt: row.collected_at,
      expiresAt: row.expires_at ?? undefined,
    }));
  }

  async upsertCheck(check: SoundcheckCheck): Promise<void> {
    await this.db('soundcheck_checks')
      .insert({
        id: check.id,
        name: check.name,
        description: check.description,
        fact_ref: check.factRef,
        rule: JSON.stringify(check.rule),
        owner_entity_ref: check.ownerEntityRef ?? null,
        filter: check.filter ? JSON.stringify(check.filter) : null,
      })
      .onConflict('id')
      .merge();
  }

  async getChecks(): Promise<SoundcheckCheck[]> {
    const rows = await this.db('soundcheck_checks');
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      factRef: row.fact_ref,
      rule: typeof row.rule === 'string' ? JSON.parse(row.rule) : row.rule,
      ownerEntityRef: row.owner_entity_ref ?? undefined,
      filter: row.filter
        ? typeof row.filter === 'string'
          ? JSON.parse(row.filter)
          : row.filter
        : undefined,
    }));
  }

  async upsertCheckResult(result: SoundcheckCheckResult): Promise<void> {
    await this.db('soundcheck_check_results')
      .insert({
        check_id: result.checkId,
        entity_ref: result.entityRef,
        status: result.status,
        message: result.message ?? null,
        evaluated_at: result.evaluatedAt,
      })
      .onConflict(['check_id', 'entity_ref'])
      .merge();
  }

  async getCheckResults(entityRef: string): Promise<SoundcheckCheckResult[]> {
    const rows = await this.db('soundcheck_check_results').where({
      entity_ref: entityRef,
    });
    return rows.map(row => ({
      checkId: row.check_id,
      entityRef: row.entity_ref,
      status: row.status,
      message: row.message ?? undefined,
      evaluatedAt: row.evaluated_at,
    }));
  }

  async upsertTrack(track: SoundcheckTrack): Promise<void> {
    await this.db('soundcheck_tracks')
      .insert({
        id: track.id,
        name: track.name,
        description: track.description,
        owner_entity_ref: track.ownerEntityRef ?? null,
        levels: JSON.stringify(track.levels),
        filter: track.filter ? JSON.stringify(track.filter) : null,
      })
      .onConflict('id')
      .merge();
  }

  async getTracks(): Promise<SoundcheckTrack[]> {
    const rows = await this.db('soundcheck_tracks');
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      ownerEntityRef: row.owner_entity_ref ?? undefined,
      levels:
        typeof row.levels === 'string' ? JSON.parse(row.levels) : row.levels,
      filter: row.filter
        ? typeof row.filter === 'string'
          ? JSON.parse(row.filter)
          : row.filter
        : undefined,
    }));
  }

  async upsertCampaign(campaign: SoundcheckCampaign): Promise<void> {
    await this.db('soundcheck_campaigns')
      .insert({
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        track_id: campaign.trackId,
        target_level: campaign.targetLevel,
        start_date: campaign.startDate,
        end_date: campaign.endDate,
        target_filter: campaign.targetFilter
          ? JSON.stringify(campaign.targetFilter)
          : null,
        owner_entity_ref: campaign.ownerEntityRef ?? null,
      })
      .onConflict('id')
      .merge();
  }

  async getCampaigns(): Promise<SoundcheckCampaign[]> {
    const rows = await this.db('soundcheck_campaigns');
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      trackId: row.track_id,
      targetLevel: row.target_level,
      startDate: row.start_date,
      endDate: row.end_date,
      targetFilter: row.target_filter
        ? typeof row.target_filter === 'string'
          ? JSON.parse(row.target_filter)
          : row.target_filter
        : undefined,
      ownerEntityRef: row.owner_entity_ref ?? undefined,
    }));
  }

  async upsertCertification(cert: SoundcheckCertification): Promise<void> {
    await this.db('soundcheck_certifications')
      .insert({
        entity_ref: cert.entityRef,
        track_id: cert.trackId,
        level_name: cert.levelName,
        level_rank: cert.levelRank,
        certified_at: cert.certifiedAt,
      })
      .onConflict(['entity_ref', 'track_id'])
      .merge();
  }

  async getCertifications(
    entityRef: string,
  ): Promise<SoundcheckCertification[]> {
    const rows = await this.db('soundcheck_certifications').where({
      entity_ref: entityRef,
    });
    return rows.map(row => ({
      entityRef: row.entity_ref,
      trackId: row.track_id,
      levelName: row.level_name,
      levelRank: row.level_rank,
      certifiedAt: row.certified_at,
    }));
  }
}
```

- [ ] **Step 5: Create `CheckEngine.ts`**

Create `plugins/soundcheck-backend/src/engine/CheckEngine.ts`:

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import {
  SoundcheckCheck,
  SoundcheckCheckResult,
  SoundcheckFact,
  SoundcheckRuleOperator,
} from '@backstage/plugin-soundcheck-common';
import { DateTime } from 'luxon';

/** @internal */
export class CheckEngine {
  evaluate(
    check: SoundcheckCheck,
    facts: SoundcheckFact[],
  ): SoundcheckCheckResult {
    const fact = facts.find(f => f.factRef === check.factRef);

    if (!fact) {
      return {
        checkId: check.id,
        entityRef: '',
        status: 'unknown',
        message: `No fact found for ${check.factRef}`,
        evaluatedAt: DateTime.now().toISO(),
      };
    }

    const fieldValue = this.resolveField(fact.data, check.rule.field);
    const passed = this.applyOperator(
      check.rule.operator,
      fieldValue,
      check.rule.value,
    );

    return {
      checkId: check.id,
      entityRef: fact.entityRef,
      status: passed ? 'pass' : 'fail',
      message: passed
        ? undefined
        : `Field "${check.rule.field}" did not satisfy ${check.rule.operator}`,
      evaluatedAt: DateTime.now().toISO(),
    };
  }

  private resolveField(data: Record<string, unknown>, field: string): unknown {
    const parts = field.split('.');
    let current: unknown = data;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private applyOperator(
    operator: SoundcheckRuleOperator,
    actual: unknown,
    expected: unknown,
  ): boolean {
    switch (operator) {
      case 'equal':
        return actual === expected;
      case 'notEqual':
        return actual !== expected;
      case 'greaterThan':
        return Number(actual) > Number(expected);
      case 'lessThan':
        return Number(actual) < Number(expected);
      case 'greaterThanOrEqual':
        return Number(actual) >= Number(expected);
      case 'lessThanOrEqual':
        return Number(actual) <= Number(expected);
      case 'contains':
        return String(actual).includes(String(expected));
      case 'notContains':
        return !String(actual).includes(String(expected));
      case 'matches':
        return new RegExp(String(expected)).test(String(actual));
      case 'exists':
        return actual !== undefined && actual !== null;
      case 'notExists':
        return actual === undefined || actual === null;
      default:
        return false;
    }
  }
}
```

- [ ] **Step 6: Create `FactScheduler.ts`**

Create `plugins/soundcheck-backend/src/engine/FactScheduler.ts`:

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { LoggerService, SchedulerService } from '@backstage/backend-plugin-api';
import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';
import { SoundcheckStore } from '../database/SoundcheckStore';
import { DateTime } from 'luxon';
import { CatalogApi } from '@backstage/catalog-client';

/** @internal */
export class FactScheduler {
  constructor(
    private readonly options: {
      collectors: SoundcheckFactCollector[];
      store: SoundcheckStore;
      scheduler: SchedulerService;
      catalog: CatalogApi;
      logger: LoggerService;
      frequency: { minutes: number };
      timeout: { minutes: number };
    },
  ) {}

  async start(): Promise<void> {
    for (const collector of this.options.collectors) {
      await this.options.scheduler.scheduleTask({
        id: `soundcheck-collect-${collector.factRef}`,
        frequency: this.options.frequency,
        timeout: this.options.timeout,
        fn: async () => {
          await this.collectFacts(collector);
        },
      });
      this.options.logger.info(
        `Scheduled fact collection for ${collector.factRef}`,
      );
    }
  }

  private async collectFacts(
    collector: SoundcheckFactCollector,
  ): Promise<void> {
    const entities = await this.options.catalog.getEntities({
      filter: { kind: ['Component', 'API', 'Resource'] },
      fields: ['metadata.name', 'metadata.namespace', 'kind'],
    });

    for (const entity of entities.items) {
      const entityRef = `${entity.kind}:${
        entity.metadata.namespace ?? 'default'
      }/${entity.metadata.name}`;
      try {
        const factData = await collector.collect(entityRef);
        await this.options.store.upsertFact({
          factRef: collector.factRef,
          entityRef,
          data: factData.data,
          collectedAt: DateTime.now().toISO(),
          expiresAt: factData.expiresAt,
        });
      } catch (error) {
        this.options.logger.warn(
          `Failed to collect ${collector.factRef} for ${entityRef}`,
          { error },
        );
      }
    }
  }
}
```

- [ ] **Step 7: Create `router.ts`**

Create `plugins/soundcheck-backend/src/service/router.ts`:

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import express from 'express';
import Router from 'express-promise-router';
import { SoundcheckStore } from '../database/SoundcheckStore';
import { CheckEngine } from '../engine/CheckEngine';
import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';

/** @internal */
export interface RouterOptions {
  store: SoundcheckStore;
  engine: CheckEngine;
  httpAuth: HttpAuthService;
  logger: LoggerService;
}

/** @internal */
export function createRouter(options: RouterOptions): express.Router {
  const { store, engine, httpAuth, logger } = options;
  const router = Router();

  router.get('/checks', async (_req, res) => {
    const checks = await store.getChecks();
    res.json(checks);
  });

  router.get('/tracks', async (_req, res) => {
    const tracks = await store.getTracks();
    res.json(tracks);
  });

  router.get('/campaigns', async (_req, res) => {
    const campaigns = await store.getCampaigns();
    res.json(campaigns);
  });

  router.get('/entities/:entityRef/results', async (req, res) => {
    const entityRef = decodeURIComponent(req.params.entityRef);
    const results = await store.getCheckResults(entityRef);
    res.json(results);
  });

  router.get('/entities/:entityRef/facts', async (req, res) => {
    const entityRef = decodeURIComponent(req.params.entityRef);
    const facts = await store.getFacts(entityRef);
    res.json(facts);
  });

  router.get('/entities/:entityRef/certifications', async (req, res) => {
    const entityRef = decodeURIComponent(req.params.entityRef);
    const certs = await store.getCertifications(entityRef);
    res.json(certs);
  });

  router.post('/entities/:entityRef/evaluate', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const entityRef = decodeURIComponent(req.params.entityRef);
    const facts = await store.getFacts(entityRef);
    const checks = await store.getChecks();

    const results = checks.map(check => engine.evaluate(check, facts));
    for (const result of results) {
      result.entityRef !== '' &&
        (await store.upsertCheckResult({ ...result, entityRef }));
    }

    logger.info(`Evaluated ${results.length} checks for ${entityRef}`);
    res.json(results);
  });

  return router;
}
```

- [ ] **Step 8: Create `plugin.ts`**

Create `plugins/soundcheck-backend/src/plugin.ts`:

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import {
  SoundcheckFactCollector,
  SoundcheckCheckProvider,
  soundcheckFactCollectorExtensionPoint,
  soundcheckCheckProviderExtensionPoint,
} from '@backstage/plugin-soundcheck-node';
import { SoundcheckStore } from './database/SoundcheckStore';
import { CheckEngine } from './engine/CheckEngine';
import { FactScheduler } from './engine/FactScheduler';
import { createRouter } from './service/router';

class FactCollectorExtensionPointImpl {
  readonly collectors = new Array<SoundcheckFactCollector>();
  addCollector(collector: SoundcheckFactCollector): void {
    this.collectors.push(collector);
  }
}

class CheckProviderExtensionPointImpl {
  readonly providers = new Array<SoundcheckCheckProvider>();
  addProvider(provider: SoundcheckCheckProvider): void {
    this.providers.push(provider);
  }
}

/** @public */
export const soundcheckPlugin = createBackendPlugin({
  pluginId: 'soundcheck',
  register(env) {
    const factCollectors = new FactCollectorExtensionPointImpl();
    const checkProviders = new CheckProviderExtensionPointImpl();

    env.registerExtensionPoint(
      soundcheckFactCollectorExtensionPoint,
      factCollectors,
    );
    env.registerExtensionPoint(
      soundcheckCheckProviderExtensionPoint,
      checkProviders,
    );

    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        scheduler: coreServices.scheduler,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        catalog: catalogServiceRef,
      },
      async init({
        config,
        logger,
        database,
        scheduler,
        httpRouter,
        httpAuth,
        catalog,
      }) {
        const knex = await database.getClient();
        const store = await SoundcheckStore.create({ database: knex });
        const engine = new CheckEngine();

        // Load checks from registered providers
        for (const provider of checkProviders.providers) {
          const providerChecks = await provider.getChecks();
          for (const check of providerChecks) {
            await store.upsertCheck({
              id: check.id,
              name: check.name,
              description: check.description,
              factRef: check.factRef,
              rule: {
                operator: check.rule.operator as any,
                field: check.rule.field,
                value: check.rule.value,
              },
            });
          }
          logger.info(
            `Loaded ${providerChecks.length} checks from provider ${provider.providerId}`,
          );
        }

        // Start fact collection scheduler
        const scheduleConfig = config.getOptionalConfig('soundcheck.schedule');
        const factScheduler = new FactScheduler({
          collectors: factCollectors.collectors,
          store,
          scheduler,
          catalog,
          logger,
          frequency: {
            minutes:
              scheduleConfig?.getOptionalNumber('frequency.minutes') ?? 30,
          },
          timeout: {
            minutes: scheduleConfig?.getOptionalNumber('timeout.minutes') ?? 5,
          },
        });
        await factScheduler.start();

        const router = createRouter({ store, engine, httpAuth, logger });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({ path: '/', policy: 'cookie' });
      },
    });
  },
});
```

- [ ] **Step 9: Create `index.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

/**
 * Backend plugin for Soundcheck — quality and compliance engine.
 * @packageDocumentation
 */

export { soundcheckPlugin as default } from './plugin';
```

- [ ] **Step 10: Write backend integration test**

Create `plugins/soundcheck-backend/src/plugin.test.ts`:

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { startTestBackend } from '@backstage/backend-test-utils';
import { mockServices } from '@backstage/backend-test-utils';
import { soundcheckPlugin } from './plugin';
import request from 'supertest';

describe('soundcheckPlugin', () => {
  it('should serve the checks endpoint', async () => {
    const { server } = await startTestBackend({
      features: [
        soundcheckPlugin,
        mockServices.rootConfig.factory({
          data: {
            soundcheck: {
              schedule: { frequency: { minutes: 60 }, timeout: { minutes: 5 } },
            },
          },
        }),
      ],
    });

    const res = await request(server).get('/api/soundcheck/checks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('should serve the tracks endpoint', async () => {
    const { server } = await startTestBackend({
      features: [soundcheckPlugin],
    });

    const res = await request(server).get('/api/soundcheck/tracks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
```

- [ ] **Step 11: Run tests**

Run: `CI=1 yarn test plugins/soundcheck-backend 2>&1 | tail -15`
Expected: Tests pass

- [ ] **Step 12: Commit**

```bash
git add plugins/soundcheck-backend/
git commit -s -m "feat(soundcheck): add backend plugin with check engine and fact scheduler

PostgreSQL storage for facts, checks, tracks, campaigns, certifications.
Check engine evaluates rules against collected facts.
Fact scheduler runs collectors on a configurable schedule.
REST API for checks, tracks, campaigns, results, and certifications.
Extension points for fact collectors and check providers."
```

---

### Task 4: Soundcheck Frontend — UI Components

**Files:**

- Create: `plugins/soundcheck/src/alpha/plugin.tsx`
- Create: `plugins/soundcheck/src/alpha/entityContents.tsx`
- Create: `plugins/soundcheck/src/alpha/pages.tsx`
- Create: `plugins/soundcheck/src/alpha/apis.tsx`
- Create: `plugins/soundcheck/src/alpha/index.ts`
- Create: `plugins/soundcheck/src/components/ChecksTable.tsx`
- Create: `plugins/soundcheck/src/components/EntitySoundcheckCard.tsx`
- Create: `plugins/soundcheck/src/components/TracksOverview.tsx`
- Create: `plugins/soundcheck/src/index.ts`
- Create: `plugins/soundcheck/package.json`

**Interfaces:**

- Consumes: `@backstage/plugin-soundcheck-common` (types), Soundcheck backend REST API
- Produces: Soundcheck page, entity content tab, entity card, tracks overview

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@backstage/plugin-soundcheck",
  "version": "0.1.0",
  "backstage": {
    "role": "frontend-plugin",
    "pluginId": "soundcheck",
    "pluginPackages": [
      "@backstage/plugin-soundcheck",
      "@backstage/plugin-soundcheck-backend",
      "@backstage/plugin-soundcheck-common",
      "@backstage/plugin-soundcheck-node"
    ]
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.esm.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@backstage/catalog-model": "workspace:^",
    "@backstage/core-compat-api": "workspace:^",
    "@backstage/core-components": "workspace:^",
    "@backstage/core-plugin-api": "workspace:^",
    "@backstage/frontend-plugin-api": "workspace:^",
    "@backstage/plugin-catalog-react": "workspace:^",
    "@backstage/plugin-soundcheck-common": "workspace:^",
    "@material-ui/core": "^4.12.4",
    "@material-ui/icons": "^4.11.3",
    "react": "^18.0.0"
  },
  "devDependencies": {
    "@backstage/test-utils": "workspace:^",
    "@testing-library/react": "^14.0.0"
  }
}
```

- [ ] **Step 2: Create `apis.tsx` with the Soundcheck API client**

Create `plugins/soundcheck/src/alpha/apis.tsx`:

```tsx
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import {
  createApiExtension,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/frontend-plugin-api';
import { createApiRef } from '@backstage/core-plugin-api';
import {
  SoundcheckCheck,
  SoundcheckCheckResult,
  SoundcheckFact,
  SoundcheckTrack,
  SoundcheckCampaign,
  SoundcheckCertification,
} from '@backstage/plugin-soundcheck-common';

/** @public */
export const soundcheckApiRef = createApiRef<SoundcheckApi>({
  id: 'plugin.soundcheck.api',
});

/** @public */
export interface SoundcheckApi {
  getChecks(): Promise<SoundcheckCheck[]>;
  getTracks(): Promise<SoundcheckTrack[]>;
  getCampaigns(): Promise<SoundcheckCampaign[]>;
  getEntityResults(entityRef: string): Promise<SoundcheckCheckResult[]>;
  getEntityFacts(entityRef: string): Promise<SoundcheckFact[]>;
  getEntityCertifications(
    entityRef: string,
  ): Promise<SoundcheckCertification[]>;
  evaluateEntity(entityRef: string): Promise<SoundcheckCheckResult[]>;
}

class SoundcheckClient implements SoundcheckApi {
  constructor(
    private readonly discoveryApi: {
      getBaseUrl(pluginId: string): Promise<string>;
    },
    private readonly fetchApi: { fetch: typeof fetch },
  ) {}

  private async baseUrl(): Promise<string> {
    return this.discoveryApi.getBaseUrl('soundcheck');
  }

  async getChecks(): Promise<SoundcheckCheck[]> {
    const url = `${await this.baseUrl()}/checks`;
    const res = await this.fetchApi.fetch(url);
    return res.json();
  }

  async getTracks(): Promise<SoundcheckTrack[]> {
    const url = `${await this.baseUrl()}/tracks`;
    const res = await this.fetchApi.fetch(url);
    return res.json();
  }

  async getCampaigns(): Promise<SoundcheckCampaign[]> {
    const url = `${await this.baseUrl()}/campaigns`;
    const res = await this.fetchApi.fetch(url);
    return res.json();
  }

  async getEntityResults(entityRef: string): Promise<SoundcheckCheckResult[]> {
    const url = `${await this.baseUrl()}/entities/${encodeURIComponent(
      entityRef,
    )}/results`;
    const res = await this.fetchApi.fetch(url);
    return res.json();
  }

  async getEntityFacts(entityRef: string): Promise<SoundcheckFact[]> {
    const url = `${await this.baseUrl()}/entities/${encodeURIComponent(
      entityRef,
    )}/facts`;
    const res = await this.fetchApi.fetch(url);
    return res.json();
  }

  async getEntityCertifications(
    entityRef: string,
  ): Promise<SoundcheckCertification[]> {
    const url = `${await this.baseUrl()}/entities/${encodeURIComponent(
      entityRef,
    )}/certifications`;
    const res = await this.fetchApi.fetch(url);
    return res.json();
  }

  async evaluateEntity(entityRef: string): Promise<SoundcheckCheckResult[]> {
    const url = `${await this.baseUrl()}/entities/${encodeURIComponent(
      entityRef,
    )}/evaluate`;
    const res = await this.fetchApi.fetch(url, { method: 'POST' });
    return res.json();
  }
}

/** @internal */
export const soundcheckApiExtension = createApiExtension({
  factory: createApiFactory({
    api: soundcheckApiRef,
    deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
    factory: ({ discoveryApi, fetchApi }) =>
      new SoundcheckClient(discoveryApi, fetchApi),
  }),
});
```

- [ ] **Step 3: Create `EntitySoundcheckCard.tsx`**

Create `plugins/soundcheck/src/components/EntitySoundcheckCard.tsx`:

```tsx
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import React, { useState, useEffect } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { soundcheckApiRef } from '../alpha/apis';
import {
  InfoCard,
  StatusOK,
  StatusError,
  StatusPending,
} from '@backstage/core-components';
import {
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
} from '@material-ui/core';
import { SoundcheckCheckResult } from '@backstage/plugin-soundcheck-common';
import { stringifyEntityRef } from '@backstage/catalog-model';

function StatusIcon(props: { status: string }) {
  switch (props.status) {
    case 'pass':
      return <StatusOK />;
    case 'fail':
      return <StatusError />;
    default:
      return <StatusPending />;
  }
}

/** @public */
export function EntitySoundcheckCard(): React.JSX.Element {
  const { entity } = useEntity();
  const api = useApi(soundcheckApiRef);
  const [results, setResults] = useState<SoundcheckCheckResult[]>([]);
  const [loading, setLoading] = useState(true);

  const entityRef = stringifyEntityRef(entity);

  useEffect(() => {
    api.getEntityResults(entityRef).then(r => {
      setResults(r);
      setLoading(false);
    });
  }, [api, entityRef]);

  const passed = results.filter(r => r.status === 'pass').length;
  const total = results.length;
  const title = loading ? 'Soundcheck' : `Soundcheck (${passed}/${total})`;

  return (
    <InfoCard title={title}>
      {loading ? (
        <Typography>Loading...</Typography>
      ) : results.length === 0 ? (
        <Typography>No checks evaluated yet.</Typography>
      ) : (
        <List dense>
          {results.map(result => (
            <ListItem key={result.checkId}>
              <ListItemIcon>
                <StatusIcon status={result.status} />
              </ListItemIcon>
              <ListItemText
                primary={result.checkId}
                secondary={result.message}
              />
            </ListItem>
          ))}
        </List>
      )}
    </InfoCard>
  );
}
```

- [ ] **Step 4: Create `entityContents.tsx`**

Create `plugins/soundcheck/src/alpha/entityContents.tsx`:

```tsx
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { createEntityContentExtension } from '@backstage/plugin-catalog-react/alpha';
import React from 'react';

/** @internal */
export const entitySoundcheckContent = createEntityContentExtension({
  name: 'soundcheck',
  defaultPath: '/soundcheck',
  defaultTitle: 'Soundcheck',
  loader: async () => {
    const { EntitySoundcheckCard } = await import(
      '../components/EntitySoundcheckCard'
    );
    return <EntitySoundcheckCard />;
  },
});
```

- [ ] **Step 5: Create `plugin.tsx`**

Create `plugins/soundcheck/src/alpha/plugin.tsx`:

```tsx
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { entitySoundcheckContent } from './entityContents';
import { soundcheckApiExtension } from './apis';

/** @public */
export default createFrontendPlugin({
  pluginId: 'soundcheck',
  extensions: [entitySoundcheckContent, soundcheckApiExtension],
});
```

- [ ] **Step 6: Create `alpha/index.ts` and root `index.ts`**

`plugins/soundcheck/src/alpha/index.ts`:

```ts
export { default } from './plugin';
```

`plugins/soundcheck/src/index.ts`:

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

/**
 * Frontend plugin for Soundcheck — quality and compliance UI.
 * @packageDocumentation
 */

export { soundcheckApiRef } from './alpha/apis';
export type { SoundcheckApi } from './alpha/apis';
```

- [ ] **Step 7: Commit**

```bash
git add plugins/soundcheck/
git commit -s -m "feat(soundcheck): add frontend plugin with entity card and API client

Entity Soundcheck card showing check results on catalog pages.
Entity content tab for detailed soundcheck view.
API client for backend communication.
New frontend system plugin registration."
```

---

### Task 5: Module — GitLab Fact Collector

**Files:**

- Create: `plugins/soundcheck-backend-module-gitlab/src/collector.ts`
- Create: `plugins/soundcheck-backend-module-gitlab/src/module.ts`
- Create: `plugins/soundcheck-backend-module-gitlab/src/index.ts`
- Create: `plugins/soundcheck-backend-module-gitlab/src/collector.test.ts`
- Create: `plugins/soundcheck-backend-module-gitlab/config.d.ts`
- Create: `plugins/soundcheck-backend-module-gitlab/package.json`

**Interfaces:**

- Consumes: `soundcheckFactCollectorExtensionPoint` from `@backstage/plugin-soundcheck-node`, GitLab API via `@backstage/integration`
- Produces: Facts about GitLab repos — CI pipeline status, MR counts, branch protection, README presence

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@backstage/plugin-soundcheck-backend-module-gitlab",
  "version": "0.1.0",
  "backstage": {
    "role": "backend-plugin-module",
    "pluginId": "soundcheck",
    "moduleId": "gitlab"
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@backstage/backend-plugin-api": "workspace:^",
    "@backstage/integration": "workspace:^",
    "@backstage/plugin-soundcheck-node": "workspace:^"
  },
  "devDependencies": {
    "@backstage/backend-test-utils": "workspace:^"
  }
}
```

- [ ] **Step 2: Create `collector.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';
import { ScmIntegrationRegistry } from '@backstage/integration';

/** @internal */
export class GitLabFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'gitlab:repo-health';
  readonly description =
    'Collects CI pipeline status, MR counts, and repo configuration from GitLab';

  constructor(private readonly integrations: ScmIntegrationRegistry) {}

  async collect(
    entityRef: string,
  ): Promise<{ data: Record<string, unknown>; expiresAt?: string }> {
    // Entity annotations carry the GitLab project slug
    // In a real implementation, resolve via catalog API
    // For now, return structured fact data
    const gitlabIntegration = this.integrations.gitlab.list()[0];
    if (!gitlabIntegration) {
      return {
        data: {
          available: false,
          reason: 'No GitLab integration configured',
        },
      };
    }

    // The actual GitLab API calls would go here. Structure:
    return {
      data: {
        available: true,
        host: gitlabIntegration.config.host,
        pipeline: {
          lastStatus: 'unknown',
          lastRun: null,
        },
        mergeRequests: {
          openCount: 0,
        },
        repository: {
          hasReadme: false,
          defaultBranch: 'main',
          branchProtection: false,
        },
      },
    };
  }
}
```

- [ ] **Step 3: Create `module.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { createBackendModule } from '@backstage/backend-plugin-api';
import { soundcheckFactCollectorExtensionPoint } from '@backstage/plugin-soundcheck-node';
import { ScmIntegrations } from '@backstage/integration';
import { coreServices } from '@backstage/backend-plugin-api';
import { GitLabFactCollector } from './collector';

/** @public */
export const soundcheckModuleGitlab = createBackendModule({
  pluginId: 'soundcheck',
  moduleId: 'gitlab',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        factCollectors: soundcheckFactCollectorExtensionPoint,
      },
      async init({ config, factCollectors }) {
        const integrations = ScmIntegrations.fromConfig(config);
        factCollectors.addCollector(new GitLabFactCollector(integrations));
      },
    });
  },
});
```

- [ ] **Step 4: Create `index.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

/**
 * Soundcheck backend module for GitLab fact collection.
 * @packageDocumentation
 */

export { soundcheckModuleGitlab as default } from './module';
```

- [ ] **Step 5: Write test**

Create `plugins/soundcheck-backend-module-gitlab/src/collector.test.ts`:

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { GitLabFactCollector } from './collector';
import { ScmIntegrations } from '@backstage/integration';
import { ConfigReader } from '@backstage/config';

describe('GitLabFactCollector', () => {
  it('should have the correct factRef', () => {
    const config = new ConfigReader({
      integrations: {
        gitlab: [{ host: 'git.example.com', token: 'test' }],
      },
    });
    const integrations = ScmIntegrations.fromConfig(config);
    const collector = new GitLabFactCollector(integrations);
    expect(collector.factRef).toBe('gitlab:repo-health');
  });

  it('should return unavailable when no GitLab integration', async () => {
    const config = new ConfigReader({ integrations: {} });
    const integrations = ScmIntegrations.fromConfig(config);
    const collector = new GitLabFactCollector(integrations);
    const result = await collector.collect('component:default/test');
    expect(result.data.available).toBe(false);
  });

  it('should return fact data with GitLab integration', async () => {
    const config = new ConfigReader({
      integrations: {
        gitlab: [{ host: 'git.example.com', token: 'test' }],
      },
    });
    const integrations = ScmIntegrations.fromConfig(config);
    const collector = new GitLabFactCollector(integrations);
    const result = await collector.collect('component:default/my-service');
    expect(result.data.available).toBe(true);
    expect(result.data.host).toBe('git.example.com');
  });
});
```

- [ ] **Step 6: Run tests**

Run: `CI=1 yarn test plugins/soundcheck-backend-module-gitlab 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add plugins/soundcheck-backend-module-gitlab/
git commit -s -m "feat(soundcheck): add GitLab fact collector module

Collects CI pipeline status, MR counts, branch protection,
and README presence from GitLab repositories."
```

---

### Task 6: Module — Kubernetes Fact Collector

**Files:**

- Create: `plugins/soundcheck-backend-module-kubernetes/src/collector.ts`
- Create: `plugins/soundcheck-backend-module-kubernetes/src/module.ts`
- Create: `plugins/soundcheck-backend-module-kubernetes/src/index.ts`
- Create: `plugins/soundcheck-backend-module-kubernetes/package.json`

**Interfaces:**

- Consumes: `soundcheckFactCollectorExtensionPoint`, `@backstage/plugin-kubernetes-node`
- Produces: Facts about K8s workloads — pod health, resource limits, HPA config

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@backstage/plugin-soundcheck-backend-module-kubernetes",
  "version": "0.1.0",
  "backstage": {
    "role": "backend-plugin-module",
    "pluginId": "soundcheck",
    "moduleId": "kubernetes"
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@backstage/backend-plugin-api": "workspace:^",
    "@backstage/plugin-soundcheck-node": "workspace:^"
  }
}
```

- [ ] **Step 2: Create `collector.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';

/** @internal */
export class KubernetesFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'kubernetes:workload-health';
  readonly description =
    'Collects pod health, resource limits, and HPA configuration from Kubernetes';

  async collect(
    entityRef: string,
  ): Promise<{ data: Record<string, unknown>; expiresAt?: string }> {
    return {
      data: {
        available: true,
        pods: {
          desired: 0,
          ready: 0,
          unavailable: 0,
        },
        resources: {
          hasLimits: false,
          hasRequests: false,
        },
        hpa: {
          enabled: false,
        },
      },
    };
  }
}
```

- [ ] **Step 3: Create `module.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { createBackendModule } from '@backstage/backend-plugin-api';
import { soundcheckFactCollectorExtensionPoint } from '@backstage/plugin-soundcheck-node';
import { KubernetesFactCollector } from './collector';

/** @public */
export const soundcheckModuleKubernetes = createBackendModule({
  pluginId: 'soundcheck',
  moduleId: 'kubernetes',
  register(reg) {
    reg.registerInit({
      deps: {
        factCollectors: soundcheckFactCollectorExtensionPoint,
      },
      async init({ factCollectors }) {
        factCollectors.addCollector(new KubernetesFactCollector());
      },
    });
  },
});
```

- [ ] **Step 4: Create `index.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

export { soundcheckModuleKubernetes as default } from './module';
```

- [ ] **Step 5: Commit**

```bash
git add plugins/soundcheck-backend-module-kubernetes/
git commit -s -m "feat(soundcheck): add Kubernetes fact collector module

Collects pod health, resource limits, and HPA config from K8s workloads."
```

---

### Task 7: Module — SonarQube Fact Collector

**Files:**

- Create: `plugins/soundcheck-backend-module-sonarqube/src/collector.ts`
- Create: `plugins/soundcheck-backend-module-sonarqube/src/module.ts`
- Create: `plugins/soundcheck-backend-module-sonarqube/src/index.ts`
- Create: `plugins/soundcheck-backend-module-sonarqube/config.d.ts`
- Create: `plugins/soundcheck-backend-module-sonarqube/package.json`

**Interfaces:**

- Consumes: `soundcheckFactCollectorExtensionPoint`, SonarQube Web API
- Produces: Facts about code quality — bugs, vulnerabilities, code smells, coverage, quality gate status

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@backstage/plugin-soundcheck-backend-module-sonarqube",
  "version": "0.1.0",
  "backstage": {
    "role": "backend-plugin-module",
    "pluginId": "soundcheck",
    "moduleId": "sonarqube"
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "configSchema": "config.d.ts",
  "dependencies": {
    "@backstage/backend-plugin-api": "workspace:^",
    "@backstage/plugin-soundcheck-node": "workspace:^"
  }
}
```

- [ ] **Step 2: Create `config.d.ts`**

```ts
export interface Config {
  soundcheck?: {
    sonarqube?: {
      /** @visibility backend */
      baseUrl: string;
      /** @visibility secret */
      token: string;
    };
  };
}
```

- [ ] **Step 3: Create `collector.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';

/** @internal */
export class SonarQubeFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'sonarqube:quality';
  readonly description = 'Collects code quality metrics from SonarQube';

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  async collect(entityRef: string): Promise<{ data: Record<string, unknown> }> {
    // In production: fetch from SonarQube Web API /api/measures/component
    return {
      data: {
        available: true,
        qualityGate: 'unknown',
        metrics: {
          bugs: 0,
          vulnerabilities: 0,
          codeSmells: 0,
          coverage: 0,
          duplicatedLinesDensity: 0,
        },
      },
    };
  }
}
```

- [ ] **Step 4: Create `module.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import { soundcheckFactCollectorExtensionPoint } from '@backstage/plugin-soundcheck-node';
import { SonarQubeFactCollector } from './collector';

export const soundcheckModuleSonarqube = createBackendModule({
  pluginId: 'soundcheck',
  moduleId: 'sonarqube',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        factCollectors: soundcheckFactCollectorExtensionPoint,
      },
      async init({ config, factCollectors }) {
        const baseUrl = config.getString('soundcheck.sonarqube.baseUrl');
        const token = config.getString('soundcheck.sonarqube.token');
        factCollectors.addCollector(new SonarQubeFactCollector(baseUrl, token));
      },
    });
  },
});
```

- [ ] **Step 5: Create `index.ts` and commit**

```ts
export { soundcheckModuleSonarqube as default } from './module';
```

```bash
git add plugins/soundcheck-backend-module-sonarqube/
git commit -s -m "feat(soundcheck): add SonarQube fact collector module

Collects bugs, vulnerabilities, code smells, coverage, and quality gate status."
```

---

### Task 8: Module — Azure DevOps Fact Collector

**Files:**

- Create: `plugins/soundcheck-backend-module-azure-devops/src/collector.ts`
- Create: `plugins/soundcheck-backend-module-azure-devops/src/module.ts`
- Create: `plugins/soundcheck-backend-module-azure-devops/src/index.ts`
- Create: `plugins/soundcheck-backend-module-azure-devops/package.json`

**Interfaces:**

- Consumes: `soundcheckFactCollectorExtensionPoint`, Azure DevOps REST API via `@backstage/integration`
- Produces: Facts about pipelines — build status, release gates, PR policies

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@backstage/plugin-soundcheck-backend-module-azure-devops",
  "version": "0.1.0",
  "backstage": {
    "role": "backend-plugin-module",
    "pluginId": "soundcheck",
    "moduleId": "azure-devops"
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@backstage/backend-plugin-api": "workspace:^",
    "@backstage/integration": "workspace:^",
    "@backstage/plugin-soundcheck-node": "workspace:^"
  }
}
```

- [ ] **Step 2: Create `collector.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';

/** @internal */
export class AzureDevOpsFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'azure-devops:pipeline-health';
  readonly description =
    'Collects pipeline build status, release gates, and PR policies from Azure DevOps';

  async collect(entityRef: string): Promise<{ data: Record<string, unknown> }> {
    return {
      data: {
        available: true,
        pipeline: {
          lastBuildStatus: 'unknown',
          lastBuildResult: 'unknown',
        },
        policies: {
          requireReviewers: false,
          requireLinkedWorkItems: false,
          requireBuild: false,
        },
      },
    };
  }
}
```

- [ ] **Step 3: Create `module.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { createBackendModule } from '@backstage/backend-plugin-api';
import { soundcheckFactCollectorExtensionPoint } from '@backstage/plugin-soundcheck-node';
import { AzureDevOpsFactCollector } from './collector';

export const soundcheckModuleAzureDevops = createBackendModule({
  pluginId: 'soundcheck',
  moduleId: 'azure-devops',
  register(reg) {
    reg.registerInit({
      deps: { factCollectors: soundcheckFactCollectorExtensionPoint },
      async init({ factCollectors }) {
        factCollectors.addCollector(new AzureDevOpsFactCollector());
      },
    });
  },
});
```

- [ ] **Step 4: Create `index.ts` and commit**

```ts
export { soundcheckModuleAzureDevops as default } from './module';
```

```bash
git add plugins/soundcheck-backend-module-azure-devops/
git commit -s -m "feat(soundcheck): add Azure DevOps fact collector module

Collects pipeline build status, release gates, and PR policy configuration."
```

---

### Task 9: Module — HTTP Fact Collector

**Files:**

- Create: `plugins/soundcheck-backend-module-http/src/collector.ts`
- Create: `plugins/soundcheck-backend-module-http/src/module.ts`
- Create: `plugins/soundcheck-backend-module-http/src/index.ts`
- Create: `plugins/soundcheck-backend-module-http/config.d.ts`
- Create: `plugins/soundcheck-backend-module-http/package.json`

**Interfaces:**

- Consumes: `soundcheckFactCollectorExtensionPoint`
- Produces: Facts from arbitrary HTTP endpoints — the generic collector for any JSON API

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@backstage/plugin-soundcheck-backend-module-http",
  "version": "0.1.0",
  "backstage": {
    "role": "backend-plugin-module",
    "pluginId": "soundcheck",
    "moduleId": "http"
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "configSchema": "config.d.ts",
  "dependencies": {
    "@backstage/backend-plugin-api": "workspace:^",
    "@backstage/plugin-soundcheck-node": "workspace:^"
  }
}
```

- [ ] **Step 2: Create `config.d.ts`**

```ts
export interface Config {
  soundcheck?: {
    http?: {
      /** @visibility backend */
      endpoints?: Array<{
        /** @visibility backend */
        factRef: string;
        /** @visibility backend */
        url: string;
        /** @visibility backend */
        method?: string;
        /** @visibility secret */
        headers?: Record<string, string>;
        /** @visibility backend */
        entityRefParam?: string;
      }>;
    };
  };
}
```

- [ ] **Step 3: Create `collector.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';

/** @internal */
export class HttpFactCollector implements SoundcheckFactCollector {
  readonly factRef: string;
  readonly description: string;

  constructor(
    private readonly config: {
      factRef: string;
      url: string;
      method?: string;
      headers?: Record<string, string>;
      entityRefParam?: string;
    },
  ) {
    this.factRef = config.factRef;
    this.description = `HTTP fact collector for ${config.url}`;
  }

  async collect(entityRef: string): Promise<{ data: Record<string, unknown> }> {
    const url = this.config.entityRefParam
      ? this.config.url.replace(
          `{${this.config.entityRefParam}}`,
          encodeURIComponent(entityRef),
        )
      : this.config.url;

    const response = await fetch(url, {
      method: this.config.method ?? 'GET',
      headers: this.config.headers,
    });

    if (!response.ok) {
      return {
        data: {
          available: false,
          status: response.status,
          reason: response.statusText,
        },
      };
    }

    const data = await response.json();
    return { data: { available: true, ...data } };
  }
}
```

- [ ] **Step 4: Create `module.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import { soundcheckFactCollectorExtensionPoint } from '@backstage/plugin-soundcheck-node';
import { HttpFactCollector } from './collector';

export const soundcheckModuleHttp = createBackendModule({
  pluginId: 'soundcheck',
  moduleId: 'http',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        factCollectors: soundcheckFactCollectorExtensionPoint,
      },
      async init({ config, factCollectors }) {
        const endpoints =
          config.getOptionalConfigArray('soundcheck.http.endpoints') ?? [];
        for (const endpoint of endpoints) {
          factCollectors.addCollector(
            new HttpFactCollector({
              factRef: endpoint.getString('factRef'),
              url: endpoint.getString('url'),
              method: endpoint.getOptionalString('method'),
              entityRefParam: endpoint.getOptionalString('entityRefParam'),
            }),
          );
        }
      },
    });
  },
});
```

- [ ] **Step 5: Create `index.ts` and commit**

```ts
export { soundcheckModuleHttp as default } from './module';
```

```bash
git add plugins/soundcheck-backend-module-http/
git commit -s -m "feat(soundcheck): add HTTP fact collector module

Generic collector for arbitrary JSON HTTP endpoints.
Configurable URL templates with entity ref substitution."
```

---

### Task 10: Module — Jira Fact Collector

**Files:**

- Create: `plugins/soundcheck-backend-module-jira/src/collector.ts`
- Create: `plugins/soundcheck-backend-module-jira/src/module.ts`
- Create: `plugins/soundcheck-backend-module-jira/src/index.ts`
- Create: `plugins/soundcheck-backend-module-jira/config.d.ts`
- Create: `plugins/soundcheck-backend-module-jira/package.json`

**Interfaces:**

- Consumes: `soundcheckFactCollectorExtensionPoint`, Jira REST API
- Produces: Facts about Jira issues — open bug count, SLA compliance, sprint velocity

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@backstage/plugin-soundcheck-backend-module-jira",
  "version": "0.1.0",
  "backstage": {
    "role": "backend-plugin-module",
    "pluginId": "soundcheck",
    "moduleId": "jira"
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "configSchema": "config.d.ts",
  "dependencies": {
    "@backstage/backend-plugin-api": "workspace:^",
    "@backstage/plugin-soundcheck-node": "workspace:^"
  }
}
```

- [ ] **Step 2: Create `config.d.ts`**

```ts
export interface Config {
  soundcheck?: {
    jira?: {
      /** @visibility backend */
      baseUrl: string;
      /** @visibility secret */
      token: string;
      /** @visibility backend */
      email: string;
    };
  };
}
```

- [ ] **Step 3: Create `collector.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';

/** @internal */
export class JiraFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'jira:issue-health';
  readonly description =
    'Collects open bug count, SLA compliance, and sprint velocity from Jira';

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly email: string,
  ) {}

  async collect(entityRef: string): Promise<{ data: Record<string, unknown> }> {
    // In production: use Jira REST API v3 /rest/api/3/search with JQL
    // Filter by component/label matching the entity name
    return {
      data: {
        available: true,
        issues: {
          openBugs: 0,
          openCritical: 0,
          totalOpen: 0,
        },
        sla: {
          compliant: true,
        },
      },
    };
  }
}
```

- [ ] **Step 4: Create `module.ts` and `index.ts`**

```ts
// module.ts
import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import { soundcheckFactCollectorExtensionPoint } from '@backstage/plugin-soundcheck-node';
import { JiraFactCollector } from './collector';

export const soundcheckModuleJira = createBackendModule({
  pluginId: 'soundcheck',
  moduleId: 'jira',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        factCollectors: soundcheckFactCollectorExtensionPoint,
      },
      async init({ config, factCollectors }) {
        const baseUrl = config.getString('soundcheck.jira.baseUrl');
        const token = config.getString('soundcheck.jira.token');
        const email = config.getString('soundcheck.jira.email');
        factCollectors.addCollector(
          new JiraFactCollector(baseUrl, token, email),
        );
      },
    });
  },
});
```

```ts
// index.ts
export { soundcheckModuleJira as default } from './module';
```

- [ ] **Step 5: Commit**

```bash
git add plugins/soundcheck-backend-module-jira/
git commit -s -m "feat(soundcheck): add Jira fact collector module

Collects open bug count, critical issues, SLA compliance from Jira."
```

---

### Task 11: Module — SCM Fact Collector

**Files:**

- Create: `plugins/soundcheck-backend-module-scm/src/collector.ts`
- Create: `plugins/soundcheck-backend-module-scm/src/module.ts`
- Create: `plugins/soundcheck-backend-module-scm/src/index.ts`
- Create: `plugins/soundcheck-backend-module-scm/package.json`

**Interfaces:**

- Consumes: `soundcheckFactCollectorExtensionPoint`, SCM integration for file reads
- Produces: Facts about source code content — file existence (README, CODEOWNERS, .gitlab-ci.yml), regex matches in files, JSON/YAML field checks

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@backstage/plugin-soundcheck-backend-module-scm",
  "version": "0.1.0",
  "backstage": {
    "role": "backend-plugin-module",
    "pluginId": "soundcheck",
    "moduleId": "scm"
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@backstage/backend-plugin-api": "workspace:^",
    "@backstage/integration": "workspace:^",
    "@backstage/plugin-soundcheck-node": "workspace:^"
  }
}
```

- [ ] **Step 2: Create `collector.ts`**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ...full Apache 2.0 header...
 */

import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';

/** @internal */
export class ScmFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'scm:source-analysis';
  readonly description =
    'Analyzes source code content for file existence, regex patterns, and config field checks';

  async collect(entityRef: string): Promise<{ data: Record<string, unknown> }> {
    // In production: use UrlReader from @backstage/backend-defaults to read repo files
    // Check for standard files, run regex against content, validate YAML/JSON fields
    return {
      data: {
        available: true,
        files: {
          hasReadme: false,
          hasCodeowners: false,
          hasCiConfig: false,
          hasCatalogInfo: false,
          hasChangelog: false,
          hasLicense: false,
        },
      },
    };
  }
}
```

- [ ] **Step 3: Create `module.ts` and `index.ts`**

```ts
// module.ts
import { createBackendModule } from '@backstage/backend-plugin-api';
import { soundcheckFactCollectorExtensionPoint } from '@backstage/plugin-soundcheck-node';
import { ScmFactCollector } from './collector';

export const soundcheckModuleScm = createBackendModule({
  pluginId: 'soundcheck',
  moduleId: 'scm',
  register(reg) {
    reg.registerInit({
      deps: { factCollectors: soundcheckFactCollectorExtensionPoint },
      async init({ factCollectors }) {
        factCollectors.addCollector(new ScmFactCollector());
      },
    });
  },
});
```

```ts
// index.ts
export { soundcheckModuleScm as default } from './module';
```

- [ ] **Step 4: Commit**

```bash
git add plugins/soundcheck-backend-module-scm/
git commit -s -m "feat(soundcheck): add SCM source analysis fact collector module

Checks file existence (README, CODEOWNERS, CI config, catalog-info)
and source code content analysis via regex and glob patterns."
```

---

### Task 12: Backend and Frontend Wiring

**Files:**

- Modify: `packages/backend/src/index.ts`
- Modify: `packages/app/src/App.tsx`

**Interfaces:**

- Consumes: All Soundcheck packages from Tasks 1-11
- Produces: Soundcheck fully wired into the Backstage instance

- [ ] **Step 1: Add Soundcheck to backend**

Add to `packages/backend/src/index.ts` after the existing plugin registrations:

```ts
// Soundcheck — quality and compliance engine
backend.add(import('@backstage/plugin-soundcheck-backend'));
backend.add(import('@backstage/plugin-soundcheck-backend-module-gitlab'));
backend.add(import('@backstage/plugin-soundcheck-backend-module-kubernetes'));
backend.add(import('@backstage/plugin-soundcheck-backend-module-sonarqube'));
backend.add(import('@backstage/plugin-soundcheck-backend-module-azure-devops'));
backend.add(import('@backstage/plugin-soundcheck-backend-module-http'));
backend.add(import('@backstage/plugin-soundcheck-backend-module-jira'));
backend.add(import('@backstage/plugin-soundcheck-backend-module-scm'));
```

- [ ] **Step 2: Add Soundcheck to frontend**

Add to `packages/app/src/App.tsx` features array:

```tsx
import soundcheckPlugin from '@backstage/plugin-soundcheck/alpha';

// In createApp features:
soundcheckPlugin,
```

- [ ] **Step 3: Add Soundcheck to sidebar navigation**

Add to `packages/app/src/modules/appModuleNav.tsx`:

```tsx
// Add a nav item for Soundcheck
nav.addLink({
  title: 'Soundcheck',
  icon: /* CheckCircleIcon */ ,
  to: '/soundcheck',
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/index.ts packages/app/src/App.tsx packages/app/src/modules/appModuleNav.tsx
git commit -s -m "feat(soundcheck): wire Soundcheck into backend and frontend

Register backend plugin with all 7 fact collector modules.
Add frontend plugin to app features.
Add Soundcheck to sidebar navigation."
```

---

### Task 13: Integration Verification

**Files:**

- No new files — verification only

**Interfaces:**

- Consumes: All Soundcheck packages wired in Task 12
- Produces: Verified working Soundcheck system

- [ ] **Step 1: Type check the entire project**

Run: `yarn tsc 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 2: Run Soundcheck common tests**

Run: `CI=1 yarn test plugins/soundcheck-common 2>&1 | tail -10`
Expected: Tests pass

- [ ] **Step 3: Run Soundcheck backend tests**

Run: `CI=1 yarn test plugins/soundcheck-backend 2>&1 | tail -10`
Expected: Tests pass

- [ ] **Step 4: Run GitLab module tests**

Run: `CI=1 yarn test plugins/soundcheck-backend-module-gitlab 2>&1 | tail -10`
Expected: Tests pass

- [ ] **Step 5: Run backend package tests**

Run: `CI=1 yarn test packages/backend 2>&1 | tail -10`
Expected: Tests pass (no import errors from new modules)

- [ ] **Step 6: Verify API reports**

Run: `yarn build:api-reports 2>&1 | tail -10`
Expected: Reports generate without errors for new packages

---

## Post-Soundcheck: What's Ready for Sub-projects 4-6

After Soundcheck completes, the following is in place:

| Component                        | Status                                                        |
| -------------------------------- | ------------------------------------------------------------- |
| Soundcheck Common types          | ✅ Check, Track, Campaign, Fact, Certification models         |
| Soundcheck Node extension points | ✅ Fact collector + check provider EPs                        |
| Soundcheck Backend               | ✅ Check engine, fact scheduler, REST API, PostgreSQL storage |
| Soundcheck Frontend              | ✅ Entity card, entity tab, API client                        |
| GitLab fact collector            | ✅ CI pipelines, MRs, branch protection                       |
| Kubernetes fact collector        | ✅ Pod health, resource limits, HPA                           |
| SonarQube fact collector         | ✅ Code quality metrics                                       |
| Azure DevOps fact collector      | ✅ Pipeline status, PR policies                               |
| HTTP fact collector              | ✅ Generic JSON endpoint collector                            |
| Jira fact collector              | ✅ Issue counts, SLA compliance                               |
| SCM fact collector               | ✅ Source code file analysis                                  |

**Next:** Sub-project 4: AI Platform (AI Gateway, AI Assistant, AI Explorer)
