# Wave 3: Fleetshift, DevEx Metrics, Data Experience & Minor Gaps — Design Spec

## Overview

Close remaining MAJOR gaps (Fleetshift AI shifts, DevEx Metrics charts, Data Experience warehouses) and sweep all MINOR gaps (Entity Overlays, Audit Logs, Home, Skill Exchange).

## Fleetshift Deepening

### Shift Types

**Current:** Generic AI agent shift (prompt-based).

**Add:**

1. **NPM Package Shifts**

   - Specialized shift type for upgrading/migrating npm dependencies
   - Config: package name, from version, to version, apply codemods
   - Execution: `npm install`, run codemods, fix imports, run tests
   - No AI needed — deterministic transformation via scripts

2. **OpenRewrite Shifts**

   - Java/Kotlin transformation recipes
   - Config: recipe name, recipe version
   - Execution: apply OpenRewrite recipe, commit results
   - Requires Java runtime on K8s execution nodes

3. **AI Agent Shifts** (existing, enhance)
   - Add model selection per shift (dropdown in create flow)
   - Add switchable model on existing shifts
   - Connect to AI Gateway for provider selection

### Real-Time Execution UI

**Logs Tab:**

- Per-target real-time log streaming via SignalsService WebSocket
- Log levels: info, warn, error with color coding
- Auto-scroll with pause button
- Download logs button

**Diff Tab:**

- Side-by-side diff viewer using inline CSS (no Monaco dependency)
- File tree on left, diff content on right
- Expandable/collapsible file sections
- "Create PR" button per target or bulk

**Targets Tab Enhancement:**

- Status column with progress indicator (queued → cloning → transforming → testing → PR created)
- Retry failed targets button
- Cancel running targets button

### 4-Step Create Flow Enhancement

1. **Type & Name:** shift type selector (AI Agent / NPM Package / OpenRewrite), name field
2. **Configuration:** type-specific:
   - AI Agent: prompt field, model selector
   - NPM: package, from/to version, codemods toggle
   - OpenRewrite: recipe picker, recipe config
3. **PR Settings:** branch name template, PR title template, PR description template, labels
4. **Targets:** entity filter or manual repo selection, preview matched repos

---

## DevEx Metrics Deepening

### Chart Implementation

Replace sparkline stubs with real SVG chart components:

**TimeseriesChart component:**

- Responsive SVG with viewBox scaling
- X-axis: time labels (ISO weeks, months)
- Y-axis: metric values with auto-scaling
- Line with area fill beneath
- Hover tooltip showing exact value + date
- Optional overlay line (dashed, different color) for comparison

**HistogramChart component:**

- Responsive SVG bar chart
- X-axis: buckets (configurable ranges)
- Y-axis: count/frequency
- Hover tooltip with bucket range + count

**DonutChart component:**

- SVG donut for distribution display
- Legend with values and percentages
- Click segment to filter table below

### Dashboard Enhancements

**Date Range Controls:**

- Rolling: Last 1 month, 3 months, 6 months
- Fixed: Q1-Q4, H1-H2
- ISO week alignment (Monday-to-Monday)
- Stored in URL query params for shareability

**Segmentation Controls:**

- Team dropdown (populated from catalog groups)
- Soundcheck track dropdown (populated from Soundcheck API)
- Applied to all charts simultaneously

**Metric Overlays:**

- "Compare" button toggles overlay
- Default: previous period (dashed line)
- Alternative: select different metric from dropdown
- Secondary Y-axis for cross-metric comparison

**Diagnose Panel:**

- Expandable drawer at bottom of page
- Shows: query scope (entities matched), attribution distribution (% with data), data completeness warnings, missing entity annotations
- Helps admins understand why metrics look wrong

### AI Usage Metrics

New metric category alongside DORA:

- Total AI requests (via AI Gateway usage tracking)
- AI requests per developer per week
- Model usage distribution (which models, how much)
- Code acceptance rate (if trackable via Fleetshift)

Requires AI Gateway backend to expose usage aggregation endpoint.

---

## Data Experience Deepening

### Warehouse Connector Implementations

Create backend modules for each warehouse, using the `warehouseConnectorExtensionPoint`:

1. **Snowflake Module** (`plugin-data-experience-backend-module-snowflake`)

   - Config: account, warehouse, database, schema, credentials
   - Connects via `snowflake-sdk` npm package
   - Imports: tables, views as Dataset entities
   - Metadata: column schemas, row counts, last updated

2. **BigQuery Module** (`plugin-data-experience-backend-module-bigquery`)

   - Config: projectId, credentials (service account JSON)
   - Connects via `@google-cloud/bigquery`
   - Imports: tables, views, materialized views
   - Metadata: column schemas, row counts, size, last modified

3. **dbt Module** (`plugin-data-experience-backend-module-dbt`)
   - Config: dbt Cloud API token + account, or local manifest path
   - Imports: models, sources, seeds as catalog entities
   - Links dbt models to warehouse datasets (creates relations)
   - Entity tab showing dbt model details (SQL, lineage)

### Data Lineage Visualization

Frontend component showing dataset dependency graph:

- SVG-based directed graph (no external graph library)
- Nodes: datasets (tables/views)
- Edges: data flows (transformations, dbt refs)
- Click node to navigate to dataset entity page
- Zoom/pan controls
- Fits in an entity content tab

### Access Request Enhancement

Current: simple API endpoint. Add:

- Conversation thread on access request (requester ↔ owner)
- Status tracking: pending → approved/denied
- Notification to owner via Backstage notifications
- Request history per dataset

### Catalog Health View

Admin page showing ingestion status:

- Per-connector status (last sync, entities found, errors)
- Validation failure list with entity refs and error messages
- Exclusion pattern display
- "Re-sync" button per connector

---

## Minor Gap Sweep

### Entity Overlays Enhancement

**Add supported metadata types:**

- Tags (array of strings) — add/remove individual tags
- Lifecycle (string) — dropdown: production, experimental, deprecated
- Owner (already supported, verify)

**UI Enhancement:**

- Move from ellipsis menu to dedicated "Edit Overlay" button on entity page header
- Form shows current entity metadata + overlay diff preview
- Background processing indicator (spinner until catalog refresh)

### Audit Log Enhancement

**Severity levels:**

- Add `severity` field to AuditEvent type: `low | medium | high | critical`
- Default: `medium` for most mutations, `high` for permission/policy changes, `critical` for deletions

**Plugin scoping:**

- Add `pluginId` field to AuditEvent
- Each plugin backend emits events with its own pluginId
- Filter by plugin in frontend UI

**Structured request details:**

- Capture HTTP method, path, request body summary
- Store as `requestDetails` in event metadata

### Home Enhancement

**Drag-and-drop widget reordering:**

- Use HTML5 Drag and Drop API (no library needed)
- `draggable` attribute on widget containers
- Drop zones between widgets
- Save layout order to backend (or storageApi)

**Additional built-in widgets:**

- Recently Visited (already tracked by Backstage)
- Top Visited (same data source, different sort)
- Soundcheck Summary (entity pass rates)
- Team Activity (recent catalog changes by team)

### Skill Exchange Enhancement

**YAML-configured skills:**

- Config: `skillExchange.skills` array in app-config
- Skills loaded on startup, displayed as filter options
- Admin can manage via config, not just DB

**Notification builders:**

- Integrate with `@backstage/plugin-notifications-backend`
- Notify on: new gig matching skills, application received, match found
- Configurable notification channels

---

## Cross-Cutting Concerns (Wave 3)

All changes in Wave 3 apply:

1. **Tests** — every new component, store method, and API endpoint tested
2. **Permissions** — RBAC-checked write operations
3. **Audit Events** — every mutation emits to audit topic
4. **i18n** — all UI strings through translation refs
5. **Changesets** — proper changeset per modified/created package
