# Wave 3: Fleetshift, DevEx Metrics, Data Experience & Minor Gaps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close remaining MAJOR gaps (Fleetshift shift types, DevEx Metrics charts, Data Experience warehouses) and sweep all MINOR gaps (Entity Overlays, Audit Logs, Home, Skill Exchange).

**Spec:** `docs/superpowers/specs/2026-09-11-wave3-fleetshift-metrics-ecosystem.md`

## Global Constraints

- Copyright headers: Apache 2.0, year 2026
- Tests: `startTestBackend`/`mockServices.*` for backend, `renderInTestApp`/`mockApis.*` for frontend
- Every write endpoint: RBAC permission check + audit event emission
- i18n: all new UI strings via `createTranslationRef`

---

### Task 1: Fleetshift — Shift Types & Execution Engine

**Files:**

- Modify: `plugins/fleetshift-common/src/types.ts`
- Modify: `plugins/fleetshift-backend/src/service/ShiftEngine.ts`
- Create: `plugins/fleetshift-backend/src/service/NpmShiftExecutor.ts`
- Create: `plugins/fleetshift-backend/src/service/OpenRewriteShiftExecutor.ts`
- Modify: `plugins/fleetshift-backend/src/service/router.ts`

**Interfaces:**

- Consumes: ShiftStore, AI Gateway, FleetshiftProviders
- Produces: 3 shift types (AI Agent, NPM Package, OpenRewrite), real execution

- [ ] **Step 1:** Add shift types to common types: `ShiftType = 'ai-agent' | 'npm-package' | 'openrewrite'`. Add type-specific config interfaces: `NpmShiftConfig { packageName, fromVersion, toVersion, applyCodemods }`, `OpenRewriteShiftConfig { recipeName, recipeVersion }`, `AiAgentShiftConfig { prompt, modelId }`.

- [ ] **Step 2:** Create `NpmShiftExecutor.ts` — executes npm package shifts: clone repo, update package.json, run `npm install`, optionally run codemods, commit, create MR via provider.

- [ ] **Step 3:** Create `OpenRewriteShiftExecutor.ts` — executes OpenRewrite shifts: clone repo, run OpenRewrite CLI with recipe, commit, create MR via provider.

- [ ] **Step 4:** Refactor `ShiftEngine` to dispatch to the right executor based on shift type. Add model selection for AI Agent shifts (stores `modelId`, passes to AI Gateway).

- [ ] **Step 5:** Add per-target status tracking: `queued → cloning → transforming → testing → creating_pr → completed/failed`.

- [ ] **Step 6:** Write tests, commit.

---

### Task 2: Fleetshift — Real-Time Logs & Diff Preview Frontend

**Files:**

- Create: `plugins/fleetshift/src/components/LogsTab.tsx`
- Create: `plugins/fleetshift/src/components/DiffTab.tsx`
- Create: `plugins/fleetshift/src/components/DiffViewer.tsx`
- Modify: `plugins/fleetshift/src/components/ShiftDetail.tsx`

**Interfaces:**

- Consumes: Fleetshift API, Signals WebSocket
- Produces: Real-time execution logs, diff preview

- [ ] **Step 1:** Create `LogsTab.tsx` — per-target log viewer. Subscribes to `signals` for `fleetshift.logs.{shiftId}.{targetId}` topic. Color-coded log levels (info=default, warn=amber, error=red). Auto-scroll with pause toggle. Download button.

- [ ] **Step 2:** Create `DiffViewer.tsx` — side-by-side diff display using CSS grid. File tree on left (collapsible), diff hunks on right. Green/red lines for additions/removals. Line numbers.

- [ ] **Step 3:** Create `DiffTab.tsx` — fetches diff for each target from `GET /shifts/:id/targets/:targetId/diff`. Shows DiffViewer. "Create PR" button per target.

- [ ] **Step 4:** Modify `ShiftDetail.tsx` — add tabs: Overview, Targets, Logs, Diff. Targets tab shows per-target status with progress indicator icons.

- [ ] **Step 5:** Enhance create flow: add shift type selector (AI Agent / NPM / OpenRewrite), model selector for AI Agent, type-specific config forms.

- [ ] **Step 6:** Commit.

---

### Task 3: DevEx Metrics — Chart Components

**Files:**

- Create: `plugins/devex-metrics/src/components/charts/TimeseriesChart.tsx`
- Create: `plugins/devex-metrics/src/components/charts/HistogramChart.tsx`
- Create: `plugins/devex-metrics/src/components/charts/DonutChart.tsx`
- Create: `plugins/devex-metrics/src/components/charts/ChartTooltip.tsx`

**Interfaces:**

- Consumes: metric data arrays
- Produces: Reusable SVG chart components

- [ ] **Step 1:** Create `TimeseriesChart.tsx` — responsive SVG. Props: `series: Array<{label, data: Array<{date, value}>, color}>`, `overlay?: same shape`, `xLabel`, `yLabel`. Features: auto-scaled axes, grid lines, hover tooltip, area fill, optional dashed overlay line. Theme-aware colors.

- [ ] **Step 2:** Create `HistogramChart.tsx` — SVG bar chart. Props: `buckets: Array<{label, value, color?}>`. Hover tooltip with value.

- [ ] **Step 3:** Create `DonutChart.tsx` — SVG donut with legend. Props: `segments: Array<{label, value, color}>`, `size`. Click segment to highlight.

- [ ] **Step 4:** Create `ChartTooltip.tsx` — positioned tooltip component, follows mouse, shows formatted value + label.

- [ ] **Step 5:** Write visual tests (snapshot tests for SVG output), commit.

---

### Task 4: DevEx Metrics — Dashboard Enhancement

**Files:**

- Modify: `plugins/devex-metrics/src/components/DoraDashboard.tsx`
- Create: `plugins/devex-metrics/src/components/DateRangeSelector.tsx`
- Create: `plugins/devex-metrics/src/components/SegmentationSelector.tsx`
- Create: `plugins/devex-metrics/src/components/MetricOverlay.tsx`
- Create: `plugins/devex-metrics/src/components/DiagnosePanel.tsx`
- Create: `plugins/devex-metrics/src/components/AiUsageMetrics.tsx`
- Modify: `plugins/devex-metrics/src/api/MetricsClient.ts`

**Interfaces:**

- Consumes: DevEx Metrics API, Soundcheck API, Catalog API
- Produces: Full DORA dashboard with controls

- [ ] **Step 1:** Create `DateRangeSelector.tsx` — rolling (1/3/6 months) + fixed (Q1-Q4, H1-H2) selections. Stores in URL params. ISO week alignment.

- [ ] **Step 2:** Create `SegmentationSelector.tsx` — team dropdown (from catalog groups) + Soundcheck track dropdown. Applied globally to all charts.

- [ ] **Step 3:** Create `MetricOverlay.tsx` — toggle overlay on charts. Default: previous period (dashed). Alternative: select different metric for cross-correlation.

- [ ] **Step 4:** Create `DiagnosePanel.tsx` — expandable drawer. Shows: query scope (entity count, filter applied), attribution (% entities with data), completeness warnings, missing annotations.

- [ ] **Step 5:** Create `AiUsageMetrics.tsx` — new tab/section. Shows: total AI requests, per-developer usage, model distribution donut chart, trend over time.

- [ ] **Step 6:** Rebuild `DoraDashboard.tsx` — 4 DORA metric cards (deployment frequency, lead time, change failure rate, MTTR) each with TimeseriesChart. DateRange + Segmentation + Overlay controls. Diagnose panel. AI Usage tab.

- [ ] **Step 7:** Update `MetricsClient` with segmentation and date range params.

- [ ] **Step 8:** Commit.

---

### Task 5: Data Experience — Warehouse Connector Modules

**Files:**

- Create: `plugins/data-experience-backend-module-snowflake/` (full package)
- Create: `plugins/data-experience-backend-module-bigquery/` (full package)
- Create: `plugins/data-experience-backend-module-dbt/` (full package)

**Interfaces:**

- Consumes: `warehouseConnectorExtensionPoint` from data-experience-node
- Produces: 3 warehouse connector modules

- [ ] **Step 1:** Create Snowflake module: `createBackendModule` registering `SnowflakeConnector`. Config: account, warehouse, database, schema, credentials. Imports tables/views as Dataset entities.

- [ ] **Step 2:** Create BigQuery module: `createBackendModule` registering `BigQueryConnector`. Config: projectId, credentials. Imports tables/views/materialized views.

- [ ] **Step 3:** Create dbt module: `createBackendModule` registering `DbtConnector`. Config: dbt Cloud API token or local manifest path. Imports models/sources as entities, links to warehouse datasets via relations.

- [ ] **Step 4:** Each module: package.json, .eslintrc.js, config.d.ts, module.ts, connector implementation, index.ts.

- [ ] **Step 5:** Commit.

---

### Task 6: Data Experience — Lineage & Access Requests

**Files:**

- Create: `plugins/data-experience/src/components/LineageGraph.tsx`
- Create: `plugins/data-experience-backend/src/service/AccessRequestStore.ts`
- Modify: `plugins/data-experience-backend/src/service/router.ts`
- Modify: `plugins/data-experience/src/components/DatasetCatalogPage.tsx`

**Interfaces:**

- Consumes: Dataset entities, dbt relations
- Produces: Lineage visualization, access request flow

- [ ] **Step 1:** Create `LineageGraph.tsx` — SVG directed graph. Nodes: dataset entities. Edges: dbt ref relations. Layout: left-to-right DAG (simple topological sort). Click node → navigate to entity. Zoom/pan via SVG transform.

- [ ] **Step 2:** Add `AccessRequestStore` — table `data_access_requests` (id, dataset_ref, requester_ref, use_case, status, conversation JSONB, timestamps). CRUD methods.

- [ ] **Step 3:** Add access request endpoints: `POST /access-requests`, `GET /access-requests?datasetRef=`, `POST /access-requests/:id/approve`, `POST /access-requests/:id/deny`, `POST /access-requests/:id/comment`. Notifies dataset owner.

- [ ] **Step 4:** Add lineage data as entity content tab via `EntityContentBlueprint`.

- [ ] **Step 5:** Commit.

---

### Task 7: Minor Gap Sweep — Entity Overlays

**Files:**

- Modify: `plugins/entity-overlays-common/src/types.ts`
- Modify: `plugins/entity-overlays-backend/src/processor/OverlayProcessor.ts`
- Modify: `plugins/entity-overlays-backend/src/service/router.ts`
- Modify: `plugins/entity-overlays/src/components/OverlayEditor.tsx`

- [ ] **Step 1:** Add `tags` and `lifecycle` to supported overlay types. Modify `OverlayPatch.path` to accept `metadata.tags`, `spec.lifecycle`, `metadata.annotations.*`, `metadata.labels.*`.

- [ ] **Step 2:** Update `OverlayProcessor.preProcessEntity` to merge tags (array append/remove) and lifecycle (string replace).

- [ ] **Step 3:** Update `OverlayEditor.tsx` — add tags input (chip array with add/remove) and lifecycle dropdown (production/experimental/deprecated).

- [ ] **Step 4:** Commit.

---

### Task 8: Minor Gap Sweep — Audit Log Enhancement

**Files:**

- Modify: `plugins/audit-log-common/src/types.ts`
- Modify: `plugins/audit-log-backend/src/database/AuditStore.ts`
- Modify: `plugins/audit-log-backend/src/service/router.ts`
- Modify: `plugins/audit-log/src/components/AuditLogPage.tsx`

- [ ] **Step 1:** Add to `AuditEvent`: `severity: 'low' | 'medium' | 'high' | 'critical'`, `pluginId: string`, `requestDetails?: { method, path, bodySummary }`.

- [ ] **Step 2:** Update `AuditStore` — add severity and pluginId columns (migration), filter by severity and pluginId.

- [ ] **Step 3:** Update router — accept severity and pluginId query params.

- [ ] **Step 4:** Update `AuditLogPage.tsx` — add severity filter dropdown (color-coded: low=gray, medium=blue, high=amber, critical=red) and pluginId filter dropdown.

- [ ] **Step 5:** Commit.

---

### Task 9: Minor Gap Sweep — Home & Skill Exchange

**Files:**

- Modify: `plugins/home-customizer/src/components/LayoutEditor.tsx`
- Modify: `plugins/skill-exchange-backend/src/plugin.ts`
- Modify: `plugins/skill-exchange/src/components/MarketplacePage.tsx`

- [ ] **Step 1:** Home: Replace button-based reordering with HTML5 Drag and Drop API. Add `draggable` to widget containers, `onDragStart/Over/Drop` handlers, visual drop zone indicators.

- [ ] **Step 2:** Skill Exchange: Add YAML-configured skills. Read from `skillExchange.skills` config array on startup, merge with DB skills.

- [ ] **Step 3:** Skill Exchange: Integrate with `@backstage/plugin-notifications-backend` — notify on new matching gig, application received, match found.

- [ ] **Step 4:** Commit.

---

### Task 10: Wave 3 Wiring & Final Verification

**Files:**

- Modify: `packages/backend/src/index.ts`
- Modify: `packages/backend/package.json`
- Modify: `packages/app/package.json`

- [ ] **Step 1:** Backend: add warehouse connector modules (snowflake, bigquery, dbt).

- [ ] **Step 2:** `yarn tsc` — must be clean.

- [ ] **Step 3:** Run ALL modified package tests.

- [ ] **Step 4:** Run `yarn build:api-reports` for all new/modified packages.

- [ ] **Step 5:** Create changesets for all modified packages.

- [ ] **Step 6:** Commit.

---

## Post-Wave 3: Full Portal Parity

| Feature          | Portal  | Ours                | Gap                                     |
| ---------------- | ------- | ------------------- | --------------------------------------- |
| Soundcheck       | ✅ Full | ✅ Full (Wave 1)    | CLOSED                                  |
| RBAC             | ✅ Full | ✅ Full (Wave 1)    | CLOSED                                  |
| AiKA             | ✅ Full | ✅ Full (Wave 2)    | CLOSED                                  |
| Catalog Builder  | ✅ Full | ✅ Full (Wave 2)    | CLOSED                                  |
| Fleetshift       | ✅ Full | ✅ Full (Wave 3)    | CLOSED                                  |
| DevEx Metrics    | ✅ Full | ✅ Full (Wave 3)    | CLOSED                                  |
| Data Experience  | ✅ Full | ✅ Full (Wave 3)    | CLOSED                                  |
| Entity Overlays  | ✅ Full | ✅ Full (Wave 3)    | CLOSED                                  |
| Audit Logs       | ✅ Full | ✅ Full (Wave 3)    | CLOSED                                  |
| Home             | ✅ Full | ✅ Full (Wave 3)    | CLOSED                                  |
| Skill Exchange   | ✅ Full | ✅ Full (Wave 3)    | CLOSED                                  |
| Confidence Flags | ✅ Full | ✅ GrowthBook proxy | ACCEPTED (architectural choice)         |
| Portal CLI       | ✅      | ❌                  | DEFERRED (low priority for self-hosted) |
| Portal Connect   | ✅      | N/A                 | NOT APPLICABLE (self-hosted)            |

**Total packages at completion: ~70 custom plugins**
