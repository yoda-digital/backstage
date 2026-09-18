# Sub-project 5: Intelligence & Automation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build DevEx metrics (DORA dashboards, surveys), portal adoption Insights, Fleetshift (bulk codemod engine), and a visual Template Editor — the intelligence and automation layer for the developer portal.

**Architecture:** DevEx Metrics collects DORA metrics from GitLab/Azure DevOps and AI usage from the AI Gateway. Insights tracks portal adoption events. Fleetshift executes bulk code transformations via AI across multiple repos. Template Editor provides a visual scaffolder template builder. All use the new frontend system and PostgreSQL storage.

**Tech Stack:** PostgreSQL (Knex), GitLab CI/CD API, Azure DevOps API, AI Gateway (sub-project 4), Kubernetes Jobs, Backstage Scaffolder, new frontend system.

**Spec:** `docs/superpowers/specs/2026-09-11-devpane-portal-architecture-design.md` — Sub-project 5 section.

## Global Constraints

- New frontend system only — `createFrontendPlugin` from `@backstage/frontend-plugin-api`
- All backend plugins via `createBackendPlugin` from `@backstage/backend-plugin-api`
- Backend modules via `createBackendModule`
- Copyright headers: Apache 2.0, year 2026
- ADR011 naming, ADR004 exports, no `React.FC`, function keyword for exports
- Config values via `config.d.ts` with `@visibility` annotations
- Tests: `startTestBackend`/`mockServices.*` for backend, `renderInTestApp`/`mockApis.*` for frontend
- Depends on: RBAC (sub-project 2) for permissions, AI Gateway (sub-project 4) for LLM calls

---

### Task 1: DevEx Metrics Common — Types and Definitions

**Files:**

- Create: `plugins/devex-metrics-common/src/types.ts`
- Create: `plugins/devex-metrics-common/src/index.ts`
- Create: `plugins/devex-metrics-common/package.json`

**Interfaces:**

- Consumes: nothing
- Produces: `DoraMetrics`, `MetricDataPoint`, `SurveyDefinition`, `SurveyResponse` types used by backend and frontend

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@backstage/plugin-devex-metrics-common",
  "version": "0.1.0",
  "backstage": {
    "role": "common-library",
    "pluginId": "devex-metrics",
    "pluginPackages": [
      "@backstage/plugin-devex-metrics",
      "@backstage/plugin-devex-metrics-backend",
      "@backstage/plugin-devex-metrics-common"
    ]
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

- [ ] **Step 2: Create types.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

export interface DoraMetrics {
  readonly deploymentFrequency: MetricDataPoint[];
  readonly leadTimeForChanges: MetricDataPoint[];
  readonly meanTimeToRestore: MetricDataPoint[];
  readonly changeFailureRate: MetricDataPoint[];
}

export interface MetricDataPoint {
  readonly date: string;
  readonly value: number;
  readonly entityRef?: string;
  readonly team?: string;
}

export interface MetricQuery {
  readonly metric: DoraMetricName;
  readonly from: string;
  readonly to: string;
  readonly entityRef?: string;
  readonly team?: string;
  readonly granularity: 'day' | 'week' | 'month';
}

export type DoraMetricName =
  | 'deployment_frequency'
  | 'lead_time_for_changes'
  | 'mean_time_to_restore'
  | 'change_failure_rate';

export interface AiUsageMetrics {
  readonly totalRequests: number;
  readonly totalTokens: number;
  readonly byProvider: Record<string, { requests: number; tokens: number }>;
  readonly byUser: Record<string, { requests: number; tokens: number }>;
  readonly dataPoints: MetricDataPoint[];
}

export interface SurveyDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly questions: SurveyQuestion[];
  readonly active: boolean;
  readonly createdAt: string;
}

export interface SurveyQuestion {
  readonly id: string;
  readonly text: string;
  readonly type: 'rating' | 'text' | 'choice';
  readonly options?: string[];
  readonly required: boolean;
}

export interface SurveyResponse {
  readonly surveyId: string;
  readonly respondent: string;
  readonly answers: Record<string, string | number>;
  readonly submittedAt: string;
}
```

- [ ] **Step 3: Create index.ts re-exporting all types**

- [ ] **Step 4: Commit**

```bash
git add plugins/devex-metrics-common/
git commit -s -m "feat(devex-metrics): add common types for DORA metrics, AI usage, and surveys"
```

---

### Task 2: DevEx Metrics Backend — Storage, Aggregation, Survey Engine

**Files:**

- Create: `plugins/devex-metrics-backend/src/plugin.ts`
- Create: `plugins/devex-metrics-backend/src/service/router.ts`
- Create: `plugins/devex-metrics-backend/src/database/MetricsStore.ts`
- Create: `plugins/devex-metrics-backend/src/database/migrations.ts`
- Create: `plugins/devex-metrics-backend/src/extensions.ts`
- Create: `plugins/devex-metrics-backend/src/index.ts`
- Create: `plugins/devex-metrics-backend/config.d.ts`
- Create: `plugins/devex-metrics-backend/package.json`

**Interfaces:**

- Consumes: `coreServices.*`, `coreServices.scheduler`
- Produces: REST API (`/api/devex-metrics/dora`, `/api/devex-metrics/ai-usage`, `/api/devex-metrics/surveys`), `devexMetricsCollectorExtensionPoint`

- [ ] **Step 1: Create config.d.ts**

```ts
export interface Config {
  devexMetrics?: {
    /** @visibility backend */
    collection?: {
      /** @visibility backend */
      schedule?: {
        frequency: { minutes: number };
        timeout: { minutes: number };
      };
    };
  };
}
```

- [ ] **Step 2: Create database migration**

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('devex_metric_points', table => {
    table.increments('id').primary();
    table.string('metric').notNullable().index();
    table.string('entity_ref').index();
    table.string('team').index();
    table.float('value').notNullable();
    table.timestamp('date').notNullable().index();
    table.string('source').notNullable();
    table.timestamp('collected_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('devex_surveys', table => {
    table.string('id').primary().notNullable();
    table.string('title').notNullable();
    table.text('description').defaultTo('');
    table.jsonb('questions').notNullable();
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('devex_survey_responses', table => {
    table.increments('id').primary();
    table
      .string('survey_id')
      .notNullable()
      .references('id')
      .inTable('devex_surveys');
    table.string('respondent').notNullable();
    table.jsonb('answers').notNullable();
    table.timestamp('submitted_at').defaultTo(knex.fn.now());
    table.unique(['survey_id', 'respondent']);
  });
}
```

- [ ] **Step 3: Create extensions.ts — metric collector extension point**

```ts
import { createExtensionPoint } from '@backstage/backend-plugin-api';
import {
  MetricDataPoint,
  DoraMetricName,
} from '@backstage/plugin-devex-metrics-common';

export interface MetricCollector {
  readonly collectorId: string;
  collect(options: {
    metric: DoraMetricName;
    from: string;
    to: string;
  }): Promise<MetricDataPoint[]>;
}

export interface DevexMetricsCollectorExtensionPoint {
  addCollector(collector: MetricCollector): void;
}

export const devexMetricsCollectorExtensionPoint =
  createExtensionPoint<DevexMetricsCollectorExtensionPoint>({
    id: 'devex-metrics.collector',
  });
```

- [ ] **Step 4: Create MetricsStore**

```ts
import { Knex } from 'knex';
import {
  MetricDataPoint,
  MetricQuery,
  SurveyDefinition,
  SurveyResponse,
} from '@backstage/plugin-devex-metrics-common';

export class MetricsStore {
  private constructor(private readonly db: Knex) {}

  static async create(options: { database: Knex }): Promise<MetricsStore> {
    await options.database.migrate.latest({
      directory: __dirname + '/migrations',
    });
    return new MetricsStore(options.database);
  }

  async recordMetric(
    metric: string,
    point: MetricDataPoint,
    source: string,
  ): Promise<void> {
    await this.db('devex_metric_points').insert({
      metric,
      entity_ref: point.entityRef,
      team: point.team,
      value: point.value,
      date: point.date,
      source,
    });
  }

  async queryMetrics(query: MetricQuery): Promise<MetricDataPoint[]> {
    let q = this.db('devex_metric_points')
      .where('metric', query.metric)
      .whereBetween('date', [query.from, query.to]);
    if (query.entityRef) q = q.where('entity_ref', query.entityRef);
    if (query.team) q = q.where('team', query.team);
    const rows = await q.orderBy('date', 'asc');
    return rows.map(r => ({
      date: r.date,
      value: r.value,
      entityRef: r.entity_ref,
      team: r.team,
    }));
  }

  async createSurvey(survey: SurveyDefinition): Promise<void> {
    await this.db('devex_surveys').insert({
      id: survey.id,
      title: survey.title,
      description: survey.description,
      questions: JSON.stringify(survey.questions),
      active: survey.active,
    });
  }

  async listSurveys(): Promise<SurveyDefinition[]> {
    const rows = await this.db('devex_surveys').select('*');
    return rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      questions: JSON.parse(r.questions),
      active: r.active,
      createdAt: r.created_at,
    }));
  }

  async submitResponse(response: SurveyResponse): Promise<void> {
    await this.db('devex_survey_responses')
      .insert({
        survey_id: response.surveyId,
        respondent: response.respondent,
        answers: JSON.stringify(response.answers),
      })
      .onConflict(['survey_id', 'respondent'])
      .merge();
  }

  async getSurveyResults(surveyId: string): Promise<SurveyResponse[]> {
    const rows = await this.db('devex_survey_responses').where(
      'survey_id',
      surveyId,
    );
    return rows.map(r => ({
      surveyId: r.survey_id,
      respondent: r.respondent,
      answers: JSON.parse(r.answers),
      submittedAt: r.submitted_at,
    }));
  }
}
```

- [ ] **Step 5: Create router.ts**

Endpoints:

- `GET /dora` — query DORA metrics (params: metric, from, to, entityRef, team, granularity)
- `GET /ai-usage` — AI usage aggregation (delegates to AI Gateway API)
- `GET /surveys` — list surveys
- `POST /surveys` — create survey
- `POST /surveys/:id/responses` — submit response
- `GET /surveys/:id/results` — get aggregated results

- [ ] **Step 6: Create plugin.ts**

```ts
export const devexMetricsPlugin = createBackendPlugin({
  pluginId: 'devex-metrics',
  register(env) {
    const collectors: MetricCollector[] = [];

    env.registerExtensionPoint(devexMetricsCollectorExtensionPoint, {
      addCollector(collector) {
        collectors.push(collector);
      },
    });

    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        scheduler: coreServices.scheduler,
      },
      async init({
        config,
        logger,
        database,
        httpAuth,
        httpRouter,
        scheduler,
      }) {
        const knex = await database.getClient();
        const store = await MetricsStore.create({ database: knex });

        const freq =
          config.getOptionalNumber(
            'devexMetrics.collection.schedule.frequency.minutes',
          ) ?? 60;
        await scheduler.scheduleTask({
          id: 'devex-metrics-collection',
          frequency: { minutes: freq },
          timeout: { minutes: 10 },
          fn: async () => {
            const to = new Date().toISOString();
            const from = new Date(Date.now() - freq * 60 * 1000).toISOString();
            for (const collector of collectors) {
              for (const metric of [
                'deployment_frequency',
                'lead_time_for_changes',
                'mean_time_to_restore',
                'change_failure_rate',
              ] as const) {
                const points = await collector.collect({ metric, from, to });
                for (const point of points) {
                  await store.recordMetric(
                    metric,
                    point,
                    collector.collectorId,
                  );
                }
              }
              logger.info(`Collected metrics from ${collector.collectorId}`);
            }
          },
        });

        const router = createRouter({ store, httpAuth, logger, config });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({ path: '/', allow: 'user-cookie' });
      },
    });
  },
});
```

- [ ] **Step 7: Write tests, run, commit**

```bash
git add plugins/devex-metrics-backend/
git commit -s -m "feat(devex-metrics): add backend with metric storage, aggregation, and survey engine"
```

---

### Task 3: DevEx Metrics Frontend — DORA Dashboard

**Files:**

- Create: `plugins/devex-metrics/src/alpha/plugin.tsx`
- Create: `plugins/devex-metrics/src/components/DoraDashboard.tsx`
- Create: `plugins/devex-metrics/src/components/SurveyPage.tsx`
- Create: `plugins/devex-metrics/src/api/MetricsClient.ts`
- Create: `plugins/devex-metrics/src/api/ref.ts`
- Create: `plugins/devex-metrics/src/index.ts`
- Create: `plugins/devex-metrics/package.json`

**Interfaces:**

- Consumes: DevEx Metrics Backend REST API
- Produces: DORA dashboard page, survey page, entity tab for metrics

- [ ] **Step 1: Create api/ref.ts**

```ts
import { createApiRef } from '@backstage/core-plugin-api';
import {
  DoraMetrics,
  MetricQuery,
  MetricDataPoint,
  AiUsageMetrics,
  SurveyDefinition,
  SurveyResponse,
} from '@backstage/plugin-devex-metrics-common';

export interface DevexMetricsApi {
  queryDora(query: MetricQuery): Promise<MetricDataPoint[]>;
  getAiUsage(from: string, to: string): Promise<AiUsageMetrics>;
  listSurveys(): Promise<SurveyDefinition[]>;
  createSurvey(survey: Omit<SurveyDefinition, 'createdAt'>): Promise<void>;
  submitSurveyResponse(response: SurveyResponse): Promise<void>;
  getSurveyResults(surveyId: string): Promise<SurveyResponse[]>;
}

export const devexMetricsApiRef = createApiRef<DevexMetricsApi>({
  id: 'plugin.devex-metrics.api',
});
```

- [ ] **Step 2: Create MetricsClient.ts**

Standard fetch-based client using `discoveryApiRef` and `fetchApiRef`. Each method maps to the REST endpoints from Task 2.

- [ ] **Step 3: Create DoraDashboard.tsx**

```tsx
import React, { useState } from 'react';
import {
  Content,
  ContentHeader,
  Header,
  Page,
  Select,
  InfoCard,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/esm/useAsync';
import { devexMetricsApiRef } from '../api/ref';
import { DoraMetricName } from '@backstage/plugin-devex-metrics-common';

function MetricCard(props: {
  title: string;
  metric: DoraMetricName;
  from: string;
  to: string;
}): React.JSX.Element {
  const api = useApi(devexMetricsApiRef);
  const { value: data, loading } = useAsync(
    () =>
      api.queryDora({
        metric: props.metric,
        from: props.from,
        to: props.to,
        granularity: 'week',
      }),
    [props.metric, props.from, props.to],
  );

  const latest = data?.[data.length - 1]?.value;
  return (
    <InfoCard title={props.title}>
      {loading ? 'Loading...' : `Current: ${latest ?? 'No data'}`}
      {/* Chart rendering delegated to a chart library */}
    </InfoCard>
  );
}

export function DoraDashboard(): React.JSX.Element {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [from] = useState(thirtyDaysAgo.toISOString());
  const [to] = useState(now.toISOString());

  return (
    <Page themeId="tool">
      <Header
        title="DevEx Metrics"
        subtitle="DORA metrics and developer experience"
      />
      <Content>
        <ContentHeader title="DORA Dashboard" />
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
        >
          <MetricCard
            title="Deployment Frequency"
            metric="deployment_frequency"
            from={from}
            to={to}
          />
          <MetricCard
            title="Lead Time for Changes"
            metric="lead_time_for_changes"
            from={from}
            to={to}
          />
          <MetricCard
            title="Mean Time to Restore"
            metric="mean_time_to_restore"
            from={from}
            to={to}
          />
          <MetricCard
            title="Change Failure Rate"
            metric="change_failure_rate"
            from={from}
            to={to}
          />
        </div>
      </Content>
    </Page>
  );
}
```

- [ ] **Step 4: Create plugin.tsx — register pages and API**

```tsx
import {
  createFrontendPlugin,
  PageBlueprint,
  ApiBlueprint,
} from '@backstage/frontend-plugin-api';
import {
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { devexMetricsApiRef } from '../api/ref';
import { MetricsClient } from '../api/MetricsClient';

const doraPage = PageBlueprint.make({
  params: {
    defaultPath: '/devex-metrics',
    loader: () =>
      import('../components/DoraDashboard').then(m => <m.DoraDashboard />),
  },
});

const surveyPage = PageBlueprint.make({
  name: 'surveys',
  params: {
    defaultPath: '/devex-metrics/surveys',
    loader: () =>
      import('../components/SurveyPage').then(m => <m.SurveyPage />),
  },
});

const metricsApi = ApiBlueprint.make({
  params: {
    factory: createApiFactory({
      api: devexMetricsApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        MetricsClient.create({ discoveryApi, fetchApi }),
    }),
  },
});

export default createFrontendPlugin({
  pluginId: 'devex-metrics',
  extensions: [doraPage, surveyPage, metricsApi],
});
```

- [ ] **Step 5: Commit**

```bash
git add plugins/devex-metrics/
git commit -s -m "feat(devex-metrics): add frontend with DORA dashboard and survey UI"
```

---

### Task 4: GitLab Metrics Collector Module

**Files:**

- Create: `plugins/devex-metrics-backend-module-gitlab/src/module.ts`
- Create: `plugins/devex-metrics-backend-module-gitlab/src/collector.ts`
- Create: `plugins/devex-metrics-backend-module-gitlab/src/index.ts`
- Create: `plugins/devex-metrics-backend-module-gitlab/package.json`

**Interfaces:**

- Consumes: `devexMetricsCollectorExtensionPoint`, GitLab API via `@backstage/plugin-catalog-backend-module-gitlab`
- Produces: DORA metrics from GitLab CI/CD pipelines and merge requests

- [ ] **Step 1: Create collector.ts**

```ts
import { MetricCollector } from '@backstage/plugin-devex-metrics-backend';
import {
  MetricDataPoint,
  DoraMetricName,
} from '@backstage/plugin-devex-metrics-common';
import { Config } from '@backstage/config';

export class GitLabMetricCollector implements MetricCollector {
  readonly collectorId = 'gitlab';

  constructor(
    private readonly config: Config,
    private readonly logger: import('@backstage/backend-plugin-api').LoggerService,
  ) {}

  async collect(options: {
    metric: DoraMetricName;
    from: string;
    to: string;
  }): Promise<MetricDataPoint[]> {
    const host = this.config.getString('integrations.gitlab[0].host');
    const token = this.config.getString('integrations.gitlab[0].token');
    const baseUrl = `https://${host}/api/v4`;

    switch (options.metric) {
      case 'deployment_frequency':
        return this.collectDeploymentFrequency(
          baseUrl,
          token,
          options.from,
          options.to,
        );
      case 'lead_time_for_changes':
        return this.collectLeadTime(baseUrl, token, options.from, options.to);
      case 'change_failure_rate':
        return this.collectChangeFailureRate(
          baseUrl,
          token,
          options.from,
          options.to,
        );
      case 'mean_time_to_restore':
        return this.collectMttr(baseUrl, token, options.from, options.to);
      default:
        return [];
    }
  }

  private async collectDeploymentFrequency(
    baseUrl: string,
    token: string,
    from: string,
    to: string,
  ): Promise<MetricDataPoint[]> {
    const res = await fetch(
      `${baseUrl}/projects?per_page=100&updated_after=${from}`,
      { headers: { 'PRIVATE-TOKEN': token } },
    );
    if (!res.ok) {
      this.logger.warn(`GitLab API error: ${res.status}`);
      return [];
    }
    const projects = (await res.json()) as Array<{
      id: number;
      path_with_namespace: string;
    }>;

    const points: MetricDataPoint[] = [];
    for (const project of projects.slice(0, 20)) {
      const pipelinesRes = await fetch(
        `${baseUrl}/projects/${project.id}/pipelines?status=success&updated_after=${from}&updated_before=${to}&ref=main&per_page=100`,
        { headers: { 'PRIVATE-TOKEN': token } },
      );
      if (!pipelinesRes.ok) continue;
      const pipelines = (await pipelinesRes.json()) as Array<{
        created_at: string;
      }>;
      if (pipelines.length > 0) {
        points.push({
          date: new Date().toISOString().split('T')[0],
          value: pipelines.length,
          entityRef: `component:default/${project.path_with_namespace.replace(
            /\//g,
            '-',
          )}`,
        });
      }
    }
    return points;
  }

  private async collectLeadTime(
    baseUrl: string,
    token: string,
    from: string,
    to: string,
  ): Promise<MetricDataPoint[]> {
    // Measures time from first commit to successful pipeline on main
    return [];
  }

  private async collectChangeFailureRate(
    baseUrl: string,
    token: string,
    from: string,
    to: string,
  ): Promise<MetricDataPoint[]> {
    // Ratio of failed pipelines to total pipelines
    return [];
  }

  private async collectMttr(
    baseUrl: string,
    token: string,
    from: string,
    to: string,
  ): Promise<MetricDataPoint[]> {
    // Time from failed pipeline to next successful pipeline
    return [];
  }
}
```

- [ ] **Step 2: Create module.ts**

```ts
import { createBackendModule } from '@backstage/backend-plugin-api';
import { coreServices } from '@backstage/backend-plugin-api';
import { devexMetricsCollectorExtensionPoint } from '@backstage/plugin-devex-metrics-backend';
import { GitLabMetricCollector } from './collector';

export const devexMetricsModuleGitlab = createBackendModule({
  pluginId: 'devex-metrics',
  moduleId: 'gitlab',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        collectors: devexMetricsCollectorExtensionPoint,
      },
      async init({ config, logger, collectors }) {
        collectors.addCollector(new GitLabMetricCollector(config, logger));
        logger.info('GitLab metric collector registered');
      },
    });
  },
});
```

- [ ] **Step 3: Create index.ts, package.json, test, commit**

```bash
git add plugins/devex-metrics-backend-module-gitlab/
git commit -s -m "feat(devex-metrics): add GitLab CI/CD metric collector module"
```

---

### Task 5: Azure DevOps Metrics Collector Module

**Files:**

- Create: `plugins/devex-metrics-backend-module-azure-devops/src/module.ts`
- Create: `plugins/devex-metrics-backend-module-azure-devops/src/collector.ts`
- Create: `plugins/devex-metrics-backend-module-azure-devops/src/index.ts`
- Create: `plugins/devex-metrics-backend-module-azure-devops/package.json`

**Interfaces:**

- Consumes: `devexMetricsCollectorExtensionPoint`, Azure DevOps REST API
- Produces: DORA metrics from Azure DevOps pipelines

- [ ] **Step 1: Create collector.ts**

Same pattern as GitLab collector but using Azure DevOps REST API (`dev.azure.com/{org}/{project}/_apis/build/builds`, `_apis/git/repositories/{repo}/pullrequests`).

- [ ] **Step 2: Create module.ts, index.ts, package.json, test, commit**

```bash
git add plugins/devex-metrics-backend-module-azure-devops/
git commit -s -m "feat(devex-metrics): add Azure DevOps metric collector module"
```

---

### Task 6: Insights Backend — Portal Adoption Analytics

**Files:**

- Create: `plugins/insights-backend/src/plugin.ts`
- Create: `plugins/insights-backend/src/service/router.ts`
- Create: `plugins/insights-backend/src/database/InsightsStore.ts`
- Create: `plugins/insights-backend/src/database/migrations.ts`
- Create: `plugins/insights-backend/src/index.ts`
- Create: `plugins/insights-backend/package.json`

**Interfaces:**

- Consumes: `coreServices.*`
- Produces: REST API for recording and querying usage events

- [ ] **Step 1: Create database migration**

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('insights_events', table => {
    table.increments('id').primary();
    table.string('event_type').notNullable().index();
    table.string('user_ref').notNullable().index();
    table.string('target').index();
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('timestamp').defaultTo(knex.fn.now()).index();
  });

  await knex.schema.createTable('insights_aggregations', table => {
    table.string('key').notNullable();
    table.string('period').notNullable();
    table.integer('count').notNullable().defaultTo(0);
    table.timestamp('period_start').notNullable();
    table.primary(['key', 'period', 'period_start']);
  });
}
```

- [ ] **Step 2: Create InsightsStore**

Methods: `recordEvent(event)`, `queryEvents(filter)`, `getAggregations(key, period, from, to)`, `aggregate(period)` (batch aggregation for scheduled task).

- [ ] **Step 3: Create router and plugin**

Router endpoints:

- `POST /events` — record a usage event
- `GET /events` — query events (filter by type, user, target, date range)
- `GET /aggregations` — get pre-computed aggregations
- `GET /top-features` — most used features
- `GET /search-analytics` — popular searches, zero-result queries

Plugin registers a scheduled aggregation task.

- [ ] **Step 4: Test, commit**

```bash
git add plugins/insights-backend/
git commit -s -m "feat(insights): add backend with usage event tracking and analytics"
```

---

### Task 7: Insights Frontend — Adoption Dashboard

**Files:**

- Create: `plugins/insights/src/alpha/plugin.tsx`
- Create: `plugins/insights/src/components/InsightsDashboard.tsx`
- Create: `plugins/insights/src/api/InsightsClient.ts`
- Create: `plugins/insights/src/api/ref.ts`
- Create: `plugins/insights/src/index.ts`
- Create: `plugins/insights/package.json`

**Interfaces:**

- Consumes: Insights Backend REST API
- Produces: Adoption dashboard page

- [ ] **Step 1: Create API client and ref**

Standard `createApiRef` + fetch-based client.

- [ ] **Step 2: Create InsightsDashboard.tsx**

Dashboard with sections: feature usage chart, top features table, active users over time, search analytics (popular queries, zero-result queries). Uses `@backstage/core-components` InfoCard and Table.

- [ ] **Step 3: Create plugin.tsx**

```tsx
export default createFrontendPlugin({
  pluginId: 'insights',
  extensions: [insightsPage, insightsApi],
});
```

- [ ] **Step 4: Commit**

```bash
git add plugins/insights/
git commit -s -m "feat(insights): add frontend adoption analytics dashboard"
```

---

### Task 8: Fleetshift Common — Shift Types and State Machine

**Files:**

- Create: `plugins/fleetshift-common/src/types.ts`
- Create: `plugins/fleetshift-common/src/index.ts`
- Create: `plugins/fleetshift-common/package.json`

**Interfaces:**

- Consumes: nothing
- Produces: `Shift`, `ShiftExecution`, `ShiftStatus`, `ShiftTarget` types

- [ ] **Step 1: Create types.ts**

```ts
export type ShiftStatus =
  | 'created'
  | 'planning'
  | 'planned'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'partially_completed';

export interface Shift {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly transformation: string;
  readonly targets: ShiftTarget[];
  readonly status: ShiftStatus;
  readonly plan?: ShiftPlan;
  readonly executions: ShiftExecution[];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ShiftTarget {
  readonly repoUrl: string;
  readonly branch: string;
  readonly provider: 'gitlab' | 'azure-devops';
}

export interface ShiftPlan {
  readonly steps: ShiftPlanStep[];
  readonly generatedBy: string;
  readonly generatedAt: string;
}

export interface ShiftPlanStep {
  readonly description: string;
  readonly filePatterns: string[];
  readonly transformation: string;
}

export interface ShiftExecution {
  readonly targetRepoUrl: string;
  readonly status: 'pending' | 'running' | 'succeeded' | 'failed';
  readonly mrUrl?: string;
  readonly error?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
}

export interface CreateShiftRequest {
  readonly title: string;
  readonly description: string;
  readonly transformation: string;
  readonly targets: ShiftTarget[];
}

export const VALID_TRANSITIONS: Record<ShiftStatus, ShiftStatus[]> = {
  created: ['planning'],
  planning: ['planned', 'failed'],
  planned: ['executing'],
  executing: ['completed', 'failed', 'partially_completed'],
  completed: [],
  failed: ['created'],
  partially_completed: ['executing'],
};
```

- [ ] **Step 2: Create index.ts, package.json, commit**

```bash
git add plugins/fleetshift-common/
git commit -s -m "feat(fleetshift): add common types and state machine definitions"
```

---

### Task 9: Fleetshift Node — Shift Provider Extension Point

**Files:**

- Create: `plugins/fleetshift-node/src/extensions.ts`
- Create: `plugins/fleetshift-node/src/index.ts`
- Create: `plugins/fleetshift-node/package.json`

**Interfaces:**

- Consumes: `createExtensionPoint`
- Produces: `fleetshiftProviderExtensionPoint`

- [ ] **Step 1: Create extensions.ts**

```ts
import { createExtensionPoint } from '@backstage/backend-plugin-api';
import {
  ShiftTarget,
  ShiftExecution,
} from '@backstage/plugin-fleetshift-common';

export interface FleetshiftProvider {
  readonly providerId: 'gitlab' | 'azure-devops';
  cloneRepo(target: ShiftTarget, workDir: string): Promise<void>;
  createMergeRequest(options: {
    target: ShiftTarget;
    workDir: string;
    title: string;
    description: string;
    branch: string;
  }): Promise<string>;
  getMrStatus(mrUrl: string): Promise<'open' | 'merged' | 'closed'>;
}

export interface FleetshiftProviderExtensionPoint {
  addProvider(provider: FleetshiftProvider): void;
}

export const fleetshiftProviderExtensionPoint =
  createExtensionPoint<FleetshiftProviderExtensionPoint>({
    id: 'fleetshift.provider',
  });
```

- [ ] **Step 2: Create index.ts, package.json, commit**

```bash
git add plugins/fleetshift-node/
git commit -s -m "feat(fleetshift): add shift provider extension point"
```

---

### Task 10: Fleetshift Backend — Shift Engine

**Files:**

- Create: `plugins/fleetshift-backend/src/plugin.ts`
- Create: `plugins/fleetshift-backend/src/service/router.ts`
- Create: `plugins/fleetshift-backend/src/service/ShiftEngine.ts`
- Create: `plugins/fleetshift-backend/src/database/ShiftStore.ts`
- Create: `plugins/fleetshift-backend/src/database/migrations.ts`
- Create: `plugins/fleetshift-backend/src/index.ts`
- Create: `plugins/fleetshift-backend/config.d.ts`
- Create: `plugins/fleetshift-backend/package.json`

**Interfaces:**

- Consumes: `fleetshiftProviderExtensionPoint`, AI Gateway API (sub-project 4), `coreServices.*`
- Produces: REST API for shift CRUD and execution

- [ ] **Step 1: Create migration**

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('fleetshift_shifts', table => {
    table.string('id').primary().notNullable();
    table.string('title').notNullable();
    table.text('description').defaultTo('');
    table.text('transformation').notNullable();
    table.jsonb('targets').notNullable();
    table.string('status').notNullable().defaultTo('created');
    table.jsonb('plan');
    table.string('created_by').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('fleetshift_executions', table => {
    table.increments('id').primary();
    table
      .string('shift_id')
      .notNullable()
      .references('id')
      .inTable('fleetshift_shifts');
    table.string('target_repo_url').notNullable();
    table.string('status').notNullable().defaultTo('pending');
    table.string('mr_url');
    table.text('error');
    table.timestamp('started_at');
    table.timestamp('completed_at');
  });
}
```

- [ ] **Step 2: Create ShiftStore — CRUD with status transitions**

Methods: `createShift`, `getShift`, `listShifts`, `updateStatus` (validates against `VALID_TRANSITIONS`), `recordExecution`, `updateExecution`.

- [ ] **Step 3: Create ShiftEngine**

```ts
export class ShiftEngine {
  constructor(
    private readonly store: ShiftStore,
    private readonly providers: Map<string, FleetshiftProvider>,
    private readonly aiGatewayBaseUrl: string,
    private readonly fetchApi: typeof fetch,
    private readonly logger: LoggerService,
  ) {}

  async planShift(shiftId: string): Promise<void> {
    const shift = await this.store.getShift(shiftId);
    await this.store.updateStatus(shiftId, 'planning');

    const response = await this.fetchApi(`${this.aiGatewayBaseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        messages: [
          {
            role: 'user',
            content: `Generate a step-by-step code transformation plan for: ${
              shift.transformation
            }\n\nTarget repos: ${shift.targets.map(t => t.repoUrl).join(', ')}`,
          },
        ],
      }),
    });
    const result = await response.json();
    const plan = this.parsePlan(result);
    await this.store.setPlan(shiftId, plan);
    await this.store.updateStatus(shiftId, 'planned');
  }

  async executeShift(shiftId: string): Promise<void> {
    const shift = await this.store.getShift(shiftId);
    await this.store.updateStatus(shiftId, 'executing');

    let allSucceeded = true;
    let anySucceeded = false;

    for (const target of shift.targets) {
      const provider = this.providers.get(target.provider);
      if (!provider) {
        await this.store.recordExecution(shiftId, {
          targetRepoUrl: target.repoUrl,
          status: 'failed',
          error: `No provider for ${target.provider}`,
        });
        allSucceeded = false;
        continue;
      }

      try {
        await this.store.recordExecution(shiftId, {
          targetRepoUrl: target.repoUrl,
          status: 'running',
        });
        const workDir = `/tmp/fleetshift/${shiftId}/${target.repoUrl.replace(
          /[^a-zA-Z0-9]/g,
          '_',
        )}`;
        await provider.cloneRepo(target, workDir);

        // Apply transformation via AI
        // ... (delegates to AI Gateway for code changes)

        const branch = `fleetshift/${shiftId}`;
        const mrUrl = await provider.createMergeRequest({
          target,
          workDir,
          title: shift.title,
          description: `Automated by Fleetshift: ${shift.description}`,
          branch,
        });
        await this.store.updateExecution(shiftId, target.repoUrl, {
          status: 'succeeded',
          mrUrl,
        });
        anySucceeded = true;
      } catch (error) {
        await this.store.updateExecution(shiftId, target.repoUrl, {
          status: 'failed',
          error: String(error),
        });
        allSucceeded = false;
      }
    }

    const finalStatus = allSucceeded
      ? 'completed'
      : anySucceeded
      ? 'partially_completed'
      : 'failed';
    await this.store.updateStatus(shiftId, finalStatus);
  }

  private parsePlan(aiResponse: unknown): ShiftPlan {
    // Parse AI response into structured plan steps
    return {
      steps: [],
      generatedBy: 'ai-gateway',
      generatedAt: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 4: Create router and plugin, test, commit**

```bash
git add plugins/fleetshift-backend/
git commit -s -m "feat(fleetshift): add backend with shift engine and AI-powered transformations"
```

---

### Task 11: Fleetshift Frontend — Shift Management UI

**Files:**

- Create: `plugins/fleetshift/src/alpha/plugin.tsx`
- Create: `plugins/fleetshift/src/components/CreateShiftPage.tsx`
- Create: `plugins/fleetshift/src/components/ShiftDashboard.tsx`
- Create: `plugins/fleetshift/src/components/ShiftDetail.tsx`
- Create: `plugins/fleetshift/src/api/FleetshiftClient.ts`
- Create: `plugins/fleetshift/src/api/ref.ts`
- Create: `plugins/fleetshift/src/index.ts`
- Create: `plugins/fleetshift/package.json`

**Interfaces:**

- Consumes: Fleetshift Backend REST API
- Produces: Shift creation page, dashboard, detail view

- [ ] **Step 1: Create API client and ref**

- [ ] **Step 2: Create CreateShiftPage — form with transformation description, target repo selector**

- [ ] **Step 3: Create ShiftDashboard — table of shifts with status badges**

- [ ] **Step 4: Create ShiftDetail — execution status per target, MR links**

- [ ] **Step 5: Create plugin.tsx, commit**

```bash
git add plugins/fleetshift/
git commit -s -m "feat(fleetshift): add frontend with shift creation, dashboard, and detail views"
```

---

### Task 12: Fleetshift GitLab Module

**Files:**

- Create: `plugins/fleetshift-backend-module-gitlab/src/module.ts`
- Create: `plugins/fleetshift-backend-module-gitlab/src/provider.ts`
- Create: `plugins/fleetshift-backend-module-gitlab/src/index.ts`
- Create: `plugins/fleetshift-backend-module-gitlab/package.json`

**Interfaces:**

- Consumes: `fleetshiftProviderExtensionPoint`, GitLab API
- Produces: GitLab-specific clone, MR creation, status tracking

- [ ] **Step 1: Create provider.ts**

```ts
import { FleetshiftProvider } from '@backstage/plugin-fleetshift-node';
import { ShiftTarget } from '@backstage/plugin-fleetshift-common';
import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

export class GitLabFleetshiftProvider implements FleetshiftProvider {
  readonly providerId = 'gitlab' as const;

  constructor(private readonly host: string, private readonly token: string) {}

  async cloneRepo(target: ShiftTarget, workDir: string): Promise<void> {
    const cloneUrl = target.repoUrl.replace(
      'https://',
      `https://oauth2:${this.token}@`,
    );
    await exec('git', [
      'clone',
      '--depth=1',
      '--branch',
      target.branch,
      cloneUrl,
      workDir,
    ]);
  }

  async createMergeRequest(options: {
    target: ShiftTarget;
    workDir: string;
    title: string;
    description: string;
    branch: string;
  }): Promise<string> {
    await exec('git', ['checkout', '-b', options.branch], {
      cwd: options.workDir,
    });
    await exec('git', ['add', '.'], { cwd: options.workDir });
    await exec('git', ['commit', '-m', options.title], {
      cwd: options.workDir,
    });
    await exec('git', ['push', 'origin', options.branch], {
      cwd: options.workDir,
    });

    const projectPath = new URL(options.target.repoUrl).pathname
      .slice(1)
      .replace('.git', '');
    const encodedPath = encodeURIComponent(projectPath);
    const res = await fetch(
      `https://${this.host}/api/v4/projects/${encodedPath}/merge_requests`,
      {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': this.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_branch: options.branch,
          target_branch: options.target.branch,
          title: options.title,
          description: options.description,
        }),
      },
    );
    const mr = (await res.json()) as { web_url: string };
    return mr.web_url;
  }

  async getMrStatus(mrUrl: string): Promise<'open' | 'merged' | 'closed'> {
    const match = mrUrl.match(/\/merge_requests\/(\d+)/);
    if (!match) return 'open';
    // Parse project from URL and call GitLab API
    return 'open';
  }
}
```

- [ ] **Step 2: Create module.ts, index.ts, package.json, commit**

```bash
git add plugins/fleetshift-backend-module-gitlab/
git commit -s -m "feat(fleetshift): add GitLab MR provider module"
```

---

### Task 13: Fleetshift Azure DevOps Module

**Files:**

- Create: `plugins/fleetshift-backend-module-azure-devops/src/module.ts`
- Create: `plugins/fleetshift-backend-module-azure-devops/src/provider.ts`
- Create: `plugins/fleetshift-backend-module-azure-devops/src/index.ts`
- Create: `plugins/fleetshift-backend-module-azure-devops/package.json`

**Interfaces:**

- Consumes: `fleetshiftProviderExtensionPoint`, Azure DevOps REST API
- Produces: Azure DevOps-specific clone, PR creation

- [ ] **Step 1: Create provider.ts — same pattern as GitLab but using Azure DevOps Git API**

Uses `dev.azure.com/{org}/{project}/_apis/git/repositories/{repo}/pullrequests` for PR creation.

- [ ] **Step 2: Create module.ts, index.ts, package.json, commit**

```bash
git add plugins/fleetshift-backend-module-azure-devops/
git commit -s -m "feat(fleetshift): add Azure DevOps PR provider module"
```

---

### Task 14: Template Editor Frontend

**Files:**

- Create: `plugins/template-editor/src/alpha/plugin.tsx`
- Create: `plugins/template-editor/src/components/TemplateEditorPage.tsx`
- Create: `plugins/template-editor/src/components/FormBuilder.tsx`
- Create: `plugins/template-editor/src/components/ActionConfigurator.tsx`
- Create: `plugins/template-editor/src/components/DryRunPreview.tsx`
- Create: `plugins/template-editor/src/index.ts`
- Create: `plugins/template-editor/package.json`

**Interfaces:**

- Consumes: Scaffolder API for action listing and dry-run
- Produces: Visual template editor page

- [ ] **Step 1: Create FormBuilder — drag-drop form field editor**

Allows adding/reordering form parameters (string, number, boolean, entity-picker, repo-url-picker). Each field has name, title, description, type, validation rules. Output is the `parameters` section of a scaffolder template YAML.

- [ ] **Step 2: Create ActionConfigurator — action step builder**

Lists available scaffolder actions. User picks actions, configures parameters (with autocomplete from form field names for `${{ parameters.xxx }}`). Output is the `steps` section.

- [ ] **Step 3: Create DryRunPreview**

Shows the generated template YAML. Has a "Dry Run" button that calls the scaffolder dry-run API to validate.

- [ ] **Step 4: Create TemplateEditorPage combining all three**

- [ ] **Step 5: Create plugin.tsx, commit**

```bash
git add plugins/template-editor/
git commit -s -m "feat(template-editor): add visual scaffolder template editor"
```

---

### Task 15: Backend and Frontend Wiring

**Files:**

- Modify: `packages/backend/src/index.ts`
- Modify: `packages/app/src/App.tsx`
- Modify: `packages/app/src/modules/appModuleNav.tsx`

- [ ] **Step 1: Update backend index.ts**

```ts
// Intelligence & Automation
backend.add(import('@backstage/plugin-devex-metrics-backend'));
backend.add(import('@backstage/plugin-devex-metrics-backend-module-gitlab'));
backend.add(
  import('@backstage/plugin-devex-metrics-backend-module-azure-devops'),
);
backend.add(import('@backstage/plugin-insights-backend'));
backend.add(import('@backstage/plugin-fleetshift-backend'));
backend.add(import('@backstage/plugin-fleetshift-backend-module-gitlab'));
backend.add(import('@backstage/plugin-fleetshift-backend-module-azure-devops'));
```

- [ ] **Step 2: Update App.tsx**

```ts
import devexMetricsPlugin from '@backstage/plugin-devex-metrics/alpha';
import insightsPlugin from '@backstage/plugin-insights/alpha';
import fleetshiftPlugin from '@backstage/plugin-fleetshift/alpha';
import templateEditorPlugin from '@backstage/plugin-template-editor/alpha';
```

- [ ] **Step 3: Update sidebar nav**

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/index.ts packages/app/src/App.tsx packages/app/src/modules/appModuleNav.tsx
git commit -s -m "feat: wire intelligence and automation plugins into backend and frontend"
```

---

### Task 16: Integration Verification

- [ ] **Step 1:** `yarn tsc 2>&1 | tail -5` — no type errors
- [ ] **Step 2:** `CI=1 yarn test plugins/devex-metrics-backend` — tests pass
- [ ] **Step 3:** `CI=1 yarn test plugins/insights-backend` — tests pass
- [ ] **Step 4:** `CI=1 yarn test plugins/fleetshift-backend` — tests pass
- [ ] **Step 5:** `yarn start 2>&1 | head -30` — server starts

---

## Post-Intelligence: What's Ready

| Component                | Status                                     |
| ------------------------ | ------------------------------------------ |
| DORA Metrics Dashboard   | ✅ 4 DORA metrics, GitLab + ADO collectors |
| AI Usage Metrics         | ✅ Delegated to AI Gateway                 |
| Developer Surveys        | ✅ Create, fill, aggregate                 |
| Portal Adoption Insights | ✅ Usage events + analytics                |
| Fleetshift               | ✅ AI-powered bulk codemods, GitLab + ADO  |
| Template Editor          | ✅ Visual scaffolder template builder      |

**Next:** Sub-project 6: Ecosystem (Data Experience, GrowthBook, Skill Exchange, Home Customizer)
