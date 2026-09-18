# Sub-project 6: Ecosystem — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Data Experience (dataset catalog), GrowthBook integration (feature flags), Skill Exchange (internal gig marketplace), and Home Customizer (admin-controlled homepage) — the ecosystem plugins that complete the portal.

**Architecture:** Data Experience extends the Backstage catalog with a `Dataset` entity kind and warehouse connectors. GrowthBook proxies the GrowthBook OSS API for feature flags. Skill Exchange is a standalone CRUD app with notification integration. Home Customizer controls the homepage widget layout per-org with user overrides.

**Tech Stack:** PostgreSQL (Knex), Catalog Processors, GrowthBook OSS API, Backstage Notifications, new frontend system.

**Spec:** `docs/superpowers/specs/2026-09-11-devpane-portal-architecture-design.md` — Sub-project 6 section.

## Global Constraints

- New frontend system only — `createFrontendPlugin` from `@backstage/frontend-plugin-api`
- All backend plugins via `createBackendPlugin` from `@backstage/backend-plugin-api`
- Copyright headers: Apache 2.0, year 2026
- ADR011 naming, ADR004 exports, no `React.FC`, function keyword for exports
- Config via `config.d.ts` with `@visibility`
- Tests: `startTestBackend`/`mockServices.*` for backend, `renderInTestApp`/`mockApis.*` for frontend

---

### Task 1: Data Experience Common — Dataset Entity Model

**Files:**

- Create: `plugins/data-experience-common/src/types.ts`
- Create: `plugins/data-experience-common/src/index.ts`
- Create: `plugins/data-experience-common/package.json`

**Interfaces:**

- Consumes: `@backstage/catalog-model` (Entity types)
- Produces: `DatasetEntityV1alpha1`, warehouse types, quality types

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@backstage/plugin-data-experience-common",
  "version": "0.1.0",
  "backstage": {
    "role": "common-library",
    "pluginId": "data-experience",
    "pluginPackages": [
      "@backstage/plugin-data-experience",
      "@backstage/plugin-data-experience-backend",
      "@backstage/plugin-data-experience-common",
      "@backstage/plugin-data-experience-node"
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

- [ ] **Step 2: Create types.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { Entity } from '@backstage/catalog-model';

export interface DatasetEntityV1alpha1 extends Entity {
  apiVersion: 'backstage.io/v1alpha1';
  kind: 'Dataset';
  spec: DatasetSpec;
}

export interface DatasetSpec {
  readonly type: 'table' | 'view' | 'topic' | 'file' | 'stream';
  readonly warehouse: string;
  readonly schema?: string;
  readonly table?: string;
  readonly owner: string;
  readonly quality?: DatasetQuality;
  readonly tags?: string[];
}

export interface DatasetQuality {
  readonly freshness?: string;
  readonly completeness?: number;
  readonly lastChecked?: string;
}

export type WarehouseType =
  | 'bigquery'
  | 'snowflake'
  | 'postgresql'
  | 'redshift'
  | 's3';

export interface WarehouseConnection {
  readonly warehouseId: string;
  readonly type: WarehouseType;
  readonly displayName: string;
  readonly connectionConfig: Record<string, unknown>;
}

export interface DatasetMetadata {
  readonly entityRef: string;
  readonly columns?: ColumnMetadata[];
  readonly rowCount?: number;
  readonly sizeBytes?: number;
  readonly lastUpdated?: string;
}

export interface ColumnMetadata {
  readonly name: string;
  readonly type: string;
  readonly description?: string;
  readonly nullable: boolean;
}
```

- [ ] **Step 3: Create index.ts re-exporting all types, commit**

```bash
git add plugins/data-experience-common/
git commit -s -m "feat(data-experience): add common types with Dataset entity model"
```

---

### Task 2: Data Experience Node — Warehouse Connector Extension Point

**Files:**

- Create: `plugins/data-experience-node/src/extensions.ts`
- Create: `plugins/data-experience-node/src/index.ts`
- Create: `plugins/data-experience-node/package.json`

**Interfaces:**

- Consumes: `createExtensionPoint`
- Produces: `dataExperienceWarehouseExtensionPoint`

- [ ] **Step 1: Create extensions.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { createExtensionPoint } from '@backstage/backend-plugin-api';
import {
  DatasetMetadata,
  WarehouseType,
} from '@backstage/plugin-data-experience-common';

export interface WarehouseConnector {
  readonly connectorId: string;
  readonly warehouseType: WarehouseType;
  discoverDatasets(): Promise<
    Array<{ name: string; schema?: string; type: string }>
  >;
  getMetadata(datasetName: string): Promise<DatasetMetadata>;
}

export interface DataExperienceWarehouseExtensionPoint {
  addConnector(connector: WarehouseConnector): void;
}

export const dataExperienceWarehouseExtensionPoint =
  createExtensionPoint<DataExperienceWarehouseExtensionPoint>({
    id: 'data-experience.warehouse',
  });
```

- [ ] **Step 2: Create index.ts, package.json, commit**

```bash
git add plugins/data-experience-node/
git commit -s -m "feat(data-experience): add warehouse connector extension point"
```

---

### Task 3: Data Experience Backend — Dataset Registry and Catalog Processor

**Files:**

- Create: `plugins/data-experience-backend/src/plugin.ts`
- Create: `plugins/data-experience-backend/src/service/router.ts`
- Create: `plugins/data-experience-backend/src/processor/DatasetProcessor.ts`
- Create: `plugins/data-experience-backend/src/database/DatasetStore.ts`
- Create: `plugins/data-experience-backend/src/database/migrations.ts`
- Create: `plugins/data-experience-backend/src/index.ts`
- Create: `plugins/data-experience-backend/config.d.ts`
- Create: `plugins/data-experience-backend/package.json`

**Interfaces:**

- Consumes: `dataExperienceWarehouseExtensionPoint`, `catalogProcessingExtensionPoint`, `coreServices.*`
- Produces: REST API, catalog processor for Dataset kind validation

- [ ] **Step 1: Create config.d.ts**

```ts
export interface Config {
  dataExperience?: {
    /** @visibility backend */
    warehouses?: Array<{
      /** @visibility backend */
      id: string;
      /** @visibility backend */
      type: string;
      /** @visibility backend */
      displayName: string;
      /** @visibility secret */
      connection: Record<string, unknown>;
    }>;
  };
}
```

- [ ] **Step 2: Create database migration**

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('data_exp_metadata', table => {
    table.string('entity_ref').primary().notNullable();
    table.jsonb('columns').defaultTo('[]');
    table.bigInteger('row_count');
    table.bigInteger('size_bytes');
    table.timestamp('last_updated');
    table.timestamp('collected_at').defaultTo(knex.fn.now());
  });
}
```

- [ ] **Step 3: Create DatasetProcessor**

```ts
import {
  CatalogProcessor,
  CatalogProcessorEmit,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';

export class DatasetProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'DatasetProcessor';
  }

  async validateEntityKind(entity: Entity): Promise<boolean> {
    return entity.kind === 'Dataset';
  }

  async preProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== 'Dataset') return entity;

    const spec = entity.spec as Record<string, unknown>;
    if (!spec.type || !spec.warehouse || !spec.owner) {
      throw new Error(
        'Dataset entity must have spec.type, spec.warehouse, and spec.owner',
      );
    }
    return entity;
  }
}
```

- [ ] **Step 4: Create router with endpoints**

- `GET /datasets` — list datasets from catalog (query catalog API for kind=Dataset)
- `GET /datasets/:entityRef/metadata` — get enriched metadata (columns, size, freshness)
- `POST /datasets/:entityRef/refresh` — trigger metadata refresh from warehouse connector
- `GET /warehouses` — list configured warehouses

- [ ] **Step 5: Create plugin.ts**

Registers DatasetProcessor with `catalogProcessingExtensionPoint`, exposes `dataExperienceWarehouseExtensionPoint`, creates scheduled metadata collection.

- [ ] **Step 6: Test, commit**

```bash
git add plugins/data-experience-backend/
git commit -s -m "feat(data-experience): add backend with dataset registry and catalog processor"
```

---

### Task 4: Data Experience Frontend — Dataset Discovery UI

**Files:**

- Create: `plugins/data-experience/src/alpha/plugin.tsx`
- Create: `plugins/data-experience/src/components/DatasetCatalogPage.tsx`
- Create: `plugins/data-experience/src/components/DatasetDetail.tsx`
- Create: `plugins/data-experience/src/api/DataExperienceClient.ts`
- Create: `plugins/data-experience/src/api/ref.ts`
- Create: `plugins/data-experience/src/index.ts`
- Create: `plugins/data-experience/package.json`

**Interfaces:**

- Consumes: Data Experience Backend REST API, Catalog API
- Produces: Dataset discovery page, dataset detail page

- [ ] **Step 1: Create API client and ref**

```ts
import { createApiRef } from '@backstage/core-plugin-api';
import {
  DatasetMetadata,
  WarehouseConnection,
} from '@backstage/plugin-data-experience-common';

export interface DataExperienceApi {
  getMetadata(entityRef: string): Promise<DatasetMetadata>;
  refreshMetadata(entityRef: string): Promise<void>;
  listWarehouses(): Promise<WarehouseConnection[]>;
}

export const dataExperienceApiRef = createApiRef<DataExperienceApi>({
  id: 'plugin.data-experience.api',
});
```

- [ ] **Step 2: Create DatasetCatalogPage**

Page showing all Dataset entities from the catalog. Uses CatalogFilterLayout with filters for warehouse type, owner, quality status. Each row links to the dataset detail page.

- [ ] **Step 3: Create DatasetDetail**

Shows dataset metadata: columns table, freshness indicator, quality metrics, lineage preview (upstream/downstream entities from catalog relations), owner card.

- [ ] **Step 4: Create plugin.tsx**

```tsx
export default createFrontendPlugin({
  pluginId: 'data-experience',
  extensions: [datasetCatalogPage, datasetDetailPage, dataExperienceApi],
});
```

- [ ] **Step 5: Commit**

```bash
git add plugins/data-experience/
git commit -s -m "feat(data-experience): add frontend with dataset discovery and detail views"
```

---

### Task 5: GrowthBook Backend — API Proxy and Flag Sync

**Files:**

- Create: `plugins/growthbook-backend/src/plugin.ts`
- Create: `plugins/growthbook-backend/src/service/router.ts`
- Create: `plugins/growthbook-backend/src/index.ts`
- Create: `plugins/growthbook-backend/config.d.ts`
- Create: `plugins/growthbook-backend/package.json`

**Interfaces:**

- Consumes: GrowthBook OSS REST API, `coreServices.*`
- Produces: REST API proxy for GrowthBook with Backstage auth

- [ ] **Step 1: Create config.d.ts**

```ts
export interface Config {
  growthbook?: {
    /** @visibility backend */
    apiUrl: string;
    /** @visibility secret */
    apiKey: string;
    /** @visibility frontend */
    clientKey?: string;
  };
}
```

- [ ] **Step 2: Create router.ts**

```ts
import { Router } from 'express';
import { Config } from '@backstage/config';
import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { MiddlewareFactory } from '@backstage/backend-defaults/rootHttpRouter';

export interface RouterOptions {
  config: Config;
  httpAuth: HttpAuthService;
  logger: LoggerService;
}

export function createRouter(options: RouterOptions): Router {
  const { config, httpAuth, logger } = options;
  const router = Router();

  const apiUrl = config.getString('growthbook.apiUrl');
  const apiKey = config.getString('growthbook.apiKey');

  async function proxy(
    path: string,
    req: import('express').Request,
    res: import('express').Response,
  ): Promise<void> {
    await httpAuth.credentials(req, { allow: ['user'] });
    const url = `${apiUrl}/api/v1${path}`;
    const response = await fetch(url, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: ['POST', 'PUT', 'PATCH'].includes(req.method)
        ? JSON.stringify(req.body)
        : undefined,
    });
    const data = await response.json();
    res.status(response.status).json(data);
  }

  router.get('/features', (req, res) => proxy('/features', req, res));
  router.get('/features/:id', (req, res) =>
    proxy(`/features/${req.params.id}`, req, res),
  );
  router.post('/features', (req, res) => proxy('/features', req, res));
  router.put('/features/:id', (req, res) =>
    proxy(`/features/${req.params.id}`, req, res),
  );

  router.get('/experiments', (req, res) => proxy('/experiments', req, res));
  router.get('/experiments/:id', (req, res) =>
    proxy(`/experiments/${req.params.id}`, req, res),
  );
  router.post('/experiments', (req, res) => proxy('/experiments', req, res));

  const middleware = MiddlewareFactory.create({ config, logger });
  router.use(middleware.error());
  return router;
}
```

- [ ] **Step 3: Create plugin.ts**

```ts
export const growthbookPlugin = createBackendPlugin({
  pluginId: 'growthbook',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
      },
      async init({ config, logger, httpAuth, httpRouter }) {
        const router = createRouter({ config, httpAuth, logger });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({ path: '/', allow: 'user-cookie' });
        logger.info('GrowthBook proxy plugin initialized');
      },
    });
  },
});
```

- [ ] **Step 4: Test, commit**

```bash
git add plugins/growthbook-backend/
git commit -s -m "feat(growthbook): add backend API proxy for GrowthBook OSS"
```

---

### Task 6: GrowthBook Frontend — Feature Flag Management

**Files:**

- Create: `plugins/growthbook/src/alpha/plugin.tsx`
- Create: `plugins/growthbook/src/components/FeaturesPage.tsx`
- Create: `plugins/growthbook/src/components/FeatureDetail.tsx`
- Create: `plugins/growthbook/src/components/ExperimentsPage.tsx`
- Create: `plugins/growthbook/src/api/GrowthBookClient.ts`
- Create: `plugins/growthbook/src/api/ref.ts`
- Create: `plugins/growthbook/src/index.ts`
- Create: `plugins/growthbook/package.json`

**Interfaces:**

- Consumes: GrowthBook Backend proxy REST API
- Produces: Feature flag management pages, experiment viewer

- [ ] **Step 1: Create API client**

```ts
export interface GrowthBookApi {
  listFeatures(): Promise<GrowthBookFeature[]>;
  getFeature(id: string): Promise<GrowthBookFeature>;
  createFeature(feature: CreateFeatureRequest): Promise<void>;
  updateFeature(id: string, updates: Partial<GrowthBookFeature>): Promise<void>;
  listExperiments(): Promise<GrowthBookExperiment[]>;
  getExperiment(id: string): Promise<GrowthBookExperiment>;
}

export interface GrowthBookFeature {
  readonly id: string;
  readonly description: string;
  readonly valueType: 'boolean' | 'string' | 'number' | 'json';
  readonly defaultValue: unknown;
  readonly environments: Record<string, { enabled: boolean; rules: unknown[] }>;
  readonly tags: string[];
}

export interface GrowthBookExperiment {
  readonly id: string;
  readonly name: string;
  readonly status: 'draft' | 'running' | 'stopped';
  readonly variations: Array<{ name: string; value: unknown }>;
  readonly targetingCondition?: string;
}
```

- [ ] **Step 2: Create FeaturesPage — table of flags with toggle, search, tag filter**

- [ ] **Step 3: Create FeatureDetail — flag config, targeting rules, variation values**

- [ ] **Step 4: Create ExperimentsPage — experiment list with status**

- [ ] **Step 5: Create plugin.tsx, commit**

```bash
git add plugins/growthbook/
git commit -s -m "feat(growthbook): add frontend for feature flag and experiment management"
```

---

### Task 7: Skill Exchange Common — Gig Types

**Files:**

- Create: `plugins/skill-exchange-common/src/types.ts`
- Create: `plugins/skill-exchange-common/src/index.ts`
- Create: `plugins/skill-exchange-common/package.json`

**Interfaces:**

- Produces: `Gig`, `GigType`, `SkillProfile`, `GigMatch` types

- [ ] **Step 1: Create types.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

export type GigType = 'mentor' | 'pair' | 'hack' | 'embed';

export type GigStatus =
  | 'open'
  | 'matched'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface Gig {
  readonly id: string;
  readonly type: GigType;
  readonly title: string;
  readonly description: string;
  readonly skills: string[];
  readonly direction: 'offer' | 'request';
  readonly createdBy: string;
  readonly status: GigStatus;
  readonly matchedWith?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly createdAt: string;
}

export interface CreateGigRequest {
  readonly type: GigType;
  readonly title: string;
  readonly description: string;
  readonly skills: string[];
  readonly direction: 'offer' | 'request';
  readonly startDate?: string;
  readonly endDate?: string;
}

export interface GigMatch {
  readonly offerId: string;
  readonly requestId: string;
  readonly score: number;
  readonly matchedSkills: string[];
  readonly matchedAt: string;
}

export interface SkillProfile {
  readonly userRef: string;
  readonly skills: Array<{
    name: string;
    level: 'beginner' | 'intermediate' | 'expert';
  }>;
  readonly interests: string[];
  readonly availability: 'full' | 'partial' | 'none';
}
```

- [ ] **Step 2: Commit**

```bash
git add plugins/skill-exchange-common/
git commit -s -m "feat(skill-exchange): add common types for gigs, skills, and matching"
```

---

### Task 8: Skill Exchange Backend — Matching Engine

**Files:**

- Create: `plugins/skill-exchange-backend/src/plugin.ts`
- Create: `plugins/skill-exchange-backend/src/service/router.ts`
- Create: `plugins/skill-exchange-backend/src/service/MatchingEngine.ts`
- Create: `plugins/skill-exchange-backend/src/database/GigStore.ts`
- Create: `plugins/skill-exchange-backend/src/database/migrations.ts`
- Create: `plugins/skill-exchange-backend/src/index.ts`
- Create: `plugins/skill-exchange-backend/package.json`

**Interfaces:**

- Consumes: `coreServices.*`, `@backstage/plugin-notifications-node` (NotificationService)
- Produces: REST API for gig CRUD and matching

- [ ] **Step 1: Create migration**

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('skill_gigs', table => {
    table.string('id').primary().notNullable();
    table.string('type').notNullable();
    table.string('title').notNullable();
    table.text('description').defaultTo('');
    table.jsonb('skills').notNullable().defaultTo('[]');
    table.string('direction').notNullable();
    table.string('created_by').notNullable();
    table.string('status').notNullable().defaultTo('open');
    table.string('matched_with');
    table.date('start_date');
    table.date('end_date');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('skill_profiles', table => {
    table.string('user_ref').primary().notNullable();
    table.jsonb('skills').notNullable().defaultTo('[]');
    table.jsonb('interests').notNullable().defaultTo('[]');
    table.string('availability').defaultTo('partial');
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('skill_matches', table => {
    table.increments('id').primary();
    table
      .string('offer_id')
      .notNullable()
      .references('id')
      .inTable('skill_gigs');
    table
      .string('request_id')
      .notNullable()
      .references('id')
      .inTable('skill_gigs');
    table.float('score').notNullable();
    table.jsonb('matched_skills').notNullable();
    table.timestamp('matched_at').defaultTo(knex.fn.now());
  });
}
```

- [ ] **Step 2: Create MatchingEngine**

```ts
import { Gig, GigMatch } from '@backstage/plugin-skill-exchange-common';

export class MatchingEngine {
  findMatches(gig: Gig, candidates: Gig[]): GigMatch[] {
    const matches: GigMatch[] = [];
    const oppositeDirection = gig.direction === 'offer' ? 'request' : 'offer';

    for (const candidate of candidates) {
      if (candidate.direction !== oppositeDirection) continue;
      if (candidate.type !== gig.type) continue;
      if (candidate.status !== 'open') continue;
      if (candidate.createdBy === gig.createdBy) continue;

      const gigSkills = new Set(gig.skills.map(s => s.toLowerCase()));
      const matchedSkills = candidate.skills.filter(s =>
        gigSkills.has(s.toLowerCase()),
      );

      if (matchedSkills.length === 0) continue;

      const score =
        matchedSkills.length /
        Math.max(gig.skills.length, candidate.skills.length);

      matches.push({
        offerId: gig.direction === 'offer' ? gig.id : candidate.id,
        requestId: gig.direction === 'request' ? gig.id : candidate.id,
        score,
        matchedSkills,
        matchedAt: new Date().toISOString(),
      });
    }

    return matches.sort((a, b) => b.score - a.score);
  }
}
```

- [ ] **Step 3: Create router**

Endpoints:

- `POST /gigs` — create gig (auto-runs matching, sends notification if match found)
- `GET /gigs` — list gigs (filter by type, direction, status, skills)
- `GET /gigs/:id` — get gig detail
- `PUT /gigs/:id/status` — update status (accept match, complete, cancel)
- `GET /matches/:gigId` — get matches for a gig
- `GET /profile` — get current user's skill profile
- `PUT /profile` — update skill profile

- [ ] **Step 4: Create plugin.ts**

```ts
export const skillExchangePlugin = createBackendPlugin({
  pluginId: 'skill-exchange',
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        notifications: coreServices.notifications,
      },
      async init({
        config,
        logger,
        database,
        httpAuth,
        httpRouter,
        notifications,
      }) {
        const knex = await database.getClient();
        const store = await GigStore.create({ database: knex });
        const matcher = new MatchingEngine();
        const router = createRouter({
          store,
          matcher,
          httpAuth,
          logger,
          config,
          notifications,
        });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({ path: '/', allow: 'user-cookie' });
      },
    });
  },
});
```

- [ ] **Step 5: Test, commit**

```bash
git add plugins/skill-exchange-backend/
git commit -s -m "feat(skill-exchange): add backend with gig matching engine and notifications"
```

---

### Task 9: Skill Exchange Frontend — Gig Marketplace

**Files:**

- Create: `plugins/skill-exchange/src/alpha/plugin.tsx`
- Create: `plugins/skill-exchange/src/components/MarketplacePage.tsx`
- Create: `plugins/skill-exchange/src/components/CreateGigDialog.tsx`
- Create: `plugins/skill-exchange/src/components/GigDetail.tsx`
- Create: `plugins/skill-exchange/src/components/ProfileEditor.tsx`
- Create: `plugins/skill-exchange/src/api/SkillExchangeClient.ts`
- Create: `plugins/skill-exchange/src/api/ref.ts`
- Create: `plugins/skill-exchange/src/index.ts`
- Create: `plugins/skill-exchange/package.json`

**Interfaces:**

- Consumes: Skill Exchange Backend REST API
- Produces: Marketplace page, gig creation, profile editor

- [ ] **Step 1: Create API client**

- [ ] **Step 2: Create MarketplacePage**

Tabbed view: "All Gigs", "My Offers", "My Requests", "Matches". Each tab shows a filtered table. Filter controls for gig type (mentor/pair/hack/embed), skills, status.

- [ ] **Step 3: Create CreateGigDialog**

Form with: type selector, title, description, skills multi-select (autocomplete from existing skills), direction (offer/request), date range. On submit, creates gig and shows any immediate matches.

- [ ] **Step 4: Create GigDetail**

Shows gig info, matched candidates with scores, accept/decline buttons.

- [ ] **Step 5: Create ProfileEditor**

Edit skills (add/remove with level), interests, availability toggle.

- [ ] **Step 6: Create plugin.tsx, commit**

```bash
git add plugins/skill-exchange/
git commit -s -m "feat(skill-exchange): add frontend gig marketplace with matching UI"
```

---

### Task 10: Home Customizer Frontend — Admin-Controlled Homepage

**Files:**

- Create: `plugins/home-customizer/src/alpha/plugin.tsx`
- Create: `plugins/home-customizer/src/components/HomeCustomizerPage.tsx`
- Create: `plugins/home-customizer/src/components/WidgetRegistry.tsx`
- Create: `plugins/home-customizer/src/components/LayoutEditor.tsx`
- Create: `plugins/home-customizer/src/index.ts`
- Create: `plugins/home-customizer/package.json`

**Interfaces:**

- Consumes: Home plugin API, User Settings API
- Produces: Admin config page for homepage layout, widget registry

- [ ] **Step 1: Create WidgetRegistry**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import React from 'react';

export interface HomeWidget {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly component: React.ComponentType;
  readonly defaultWidth: 1 | 2 | 3 | 4;
  readonly defaultHeight: 1 | 2;
  readonly category: 'activity' | 'catalog' | 'metrics' | 'social';
}

export interface HomeLayout {
  readonly widgets: Array<{
    widgetId: string;
    position: { row: number; col: number };
    width: number;
    height: number;
  }>;
  readonly updatedAt: string;
  readonly updatedBy: string;
}

const builtinWidgets: HomeWidget[] = [
  {
    id: 'recently-visited',
    title: 'Recently Visited',
    description: 'Entities you recently viewed',
    component: React.lazy(() => import('./widgets/RecentlyVisited')),
    defaultWidth: 2,
    defaultHeight: 1,
    category: 'activity',
  },
  {
    id: 'owned-entities',
    title: 'Your Entities',
    description: 'Components and systems you own',
    component: React.lazy(() => import('./widgets/OwnedEntities')),
    defaultWidth: 2,
    defaultHeight: 1,
    category: 'catalog',
  },
  {
    id: 'starred',
    title: 'Starred',
    description: 'Your bookmarked entities',
    component: React.lazy(() => import('./widgets/Starred')),
    defaultWidth: 2,
    defaultHeight: 1,
    category: 'catalog',
  },
  {
    id: 'soundcheck-summary',
    title: 'Soundcheck Summary',
    description: 'Quality check overview for your entities',
    component: React.lazy(() => import('./widgets/SoundcheckSummary')),
    defaultWidth: 2,
    defaultHeight: 2,
    category: 'metrics',
  },
  {
    id: 'team-activity',
    title: 'Team Activity',
    description: 'Recent changes by your team',
    component: React.lazy(() => import('./widgets/TeamActivity')),
    defaultWidth: 2,
    defaultHeight: 1,
    category: 'social',
  },
];

export function getWidgetRegistry(): HomeWidget[] {
  return builtinWidgets;
}
```

- [ ] **Step 2: Create LayoutEditor — drag-drop grid configurator**

Admin-only page (RBAC-gated). Shows available widgets on the left, layout grid on the right. Drag widgets onto the grid, resize, reorder. Save layout as org default. Uses `localStorage` for user overrides (personal customization layered over org default).

- [ ] **Step 3: Create HomeCustomizerPage — wraps LayoutEditor with admin check**

- [ ] **Step 4: Create plugin.tsx**

```tsx
export default createFrontendPlugin({
  pluginId: 'home-customizer',
  extensions: [homeCustomizerPage, homeCustomizerApi],
});
```

- [ ] **Step 5: Commit**

```bash
git add plugins/home-customizer/
git commit -s -m "feat(home-customizer): add admin-controlled homepage layout with widget registry"
```

---

### Task 11: Backend and Frontend Wiring

**Files:**

- Modify: `packages/backend/src/index.ts`
- Modify: `packages/app/src/App.tsx`
- Modify: `packages/app/src/modules/appModuleNav.tsx`

- [ ] **Step 1: Update backend index.ts**

```ts
// Ecosystem
backend.add(import('@backstage/plugin-data-experience-backend'));
backend.add(import('@backstage/plugin-growthbook-backend'));
backend.add(import('@backstage/plugin-skill-exchange-backend'));
```

- [ ] **Step 2: Update App.tsx**

```ts
import dataExperiencePlugin from '@backstage/plugin-data-experience/alpha';
import growthbookPlugin from '@backstage/plugin-growthbook/alpha';
import skillExchangePlugin from '@backstage/plugin-skill-exchange/alpha';
import homeCustomizerPlugin from '@backstage/plugin-home-customizer/alpha';
```

- [ ] **Step 3: Update sidebar — add Data, Feature Flags, Skill Exchange nav items**

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/index.ts packages/app/src/App.tsx packages/app/src/modules/appModuleNav.tsx
git commit -s -m "feat: wire ecosystem plugins into backend and frontend"
```

---

### Task 12: Integration Verification

- [ ] **Step 1:** `yarn tsc 2>&1 | tail -5` — no type errors
- [ ] **Step 2:** `CI=1 yarn test plugins/data-experience-backend` — tests pass
- [ ] **Step 3:** `CI=1 yarn test plugins/growthbook-backend` — tests pass
- [ ] **Step 4:** `CI=1 yarn test plugins/skill-exchange-backend` — tests pass
- [ ] **Step 5:** `yarn start 2>&1 | head -30` — server starts

---

## Post-Ecosystem: Full Portal Ready

| Sub-project     | Status                                                          |
| --------------- | --------------------------------------------------------------- |
| 1. Foundation   | ✅ GitLab auth, catalog, K8s, PostgreSQL                        |
| 2. Governance   | ✅ RBAC, Entity Overlays, Audit Log                             |
| 3. Soundcheck   | ✅ Quality checks, 7 fact collectors                            |
| 4. AI Platform  | ✅ Gateway, Assistant, Explorer                                 |
| 5. Intelligence | ✅ DORA metrics, Insights, Fleetshift, Template Editor          |
| 6. Ecosystem    | ✅ Data Experience, GrowthBook, Skill Exchange, Home Customizer |

**Total new packages:** ~57 packages across 6 sub-projects.
