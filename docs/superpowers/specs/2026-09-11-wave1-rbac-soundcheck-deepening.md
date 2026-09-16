# Wave 1: RBAC & Soundcheck Deepening — Design Spec

## Overview

Deepen the RBAC and Soundcheck plugins from basic scaffolds to full Portal feature parity. RBAC is first because every subsequent feature depends on proper permission checks. Soundcheck is the highest-impact quality feature.

## RBAC Deepening

### Architecture

The current RBAC has: roles CRUD, bindings CRUD, basic permission policy. Portal has a full policy lifecycle, conditional rules, resolution strategies, and a testing UI.

#### Data Model Changes

**New table: `rbac_policies`**

```sql
id          TEXT PRIMARY KEY
name        TEXT NOT NULL
status      TEXT NOT NULL DEFAULT 'draft'  -- draft | published | inactive
strategy    TEXT NOT NULL DEFAULT 'first-match'  -- first-match | any-allow
rules       JSONB NOT NULL DEFAULT '[]'
created_at  TIMESTAMP DEFAULT NOW()
updated_at  TIMESTAMP DEFAULT NOW()
published_at TIMESTAMP
```

**Modify `rbac_roles`** — add `policy_id` FK to associate roles with a policy version.

**New table: `rbac_conditional_rules`**

```sql
id          TEXT PRIMARY KEY
name        TEXT NOT NULL  -- e.g., 'HAS_ANNOTATION', 'IS_ENTITY_OWNER'
description TEXT
resource_type TEXT NOT NULL  -- e.g., 'catalog-entity'
params_schema JSONB  -- JSON Schema for rule params
plugin_id   TEXT NOT NULL
```

#### Policy Lifecycle

- **Draft**: editable, not active. Multiple drafts can exist.
- **Published**: exactly one at a time. Publishing a draft makes the current published policy Inactive.
- **Inactive**: archived, read-only. Can be republished (creates a new Draft copy).
- **Republish**: clones an inactive policy as a new Draft.

#### Resolution Strategies

- **First-Match** (default): iterate roles in order, first matching decision wins.
- **Any-Allow**: scan all roles, if any gives explicit ALLOW → allow. Otherwise deny.

Stored as `strategy` field on the policy.

#### Built-in Conditional Rules

| Rule              | Resource Type  | Description                      | Params                                   |
| ----------------- | -------------- | -------------------------------- | ---------------------------------------- |
| `IS_ENTITY_OWNER` | catalog-entity | User is in entity's owner refs   | none                                     |
| `HAS_ANNOTATION`  | catalog-entity | Entity has annotation with value | `{ annotation: string, value?: string }` |
| `HAS_TAG`         | catalog-entity | Entity has specified tag         | `{ tag: string }`                        |
| `HAS_LABEL`       | catalog-entity | Entity has label with value      | `{ label: string, value?: string }`      |
| `IN_SYSTEM`       | catalog-entity | Entity belongs to system         | `{ system: string }`                     |

Rules are registered by plugins via `permissionsRegistry.addResourceType()`.

#### Policy Tester

Backend endpoint: `POST /api/rbac/policies/:id/test`

```json
Request: { "userRef": "user:default/alice", "permission": "catalog.entity.delete", "resourceRef": "component:default/my-service" }
Response: { "decision": "DENY", "matchedRole": "viewer", "matchedRule": { "permission": "catalog.entity.delete", "action": "deny" }, "evaluationChain": [...] }
```

The tester evaluates without applying — returns the full decision chain showing which role matched, which rule fired, and why.

#### YAML Import/Export

Export: full policy serialized as YAML with roles, bindings, rules, strategy.
Import: upload YAML, validate schema, create as Draft.

### Frontend Changes

- **Policy Management Page** — replace current roles-only view with full policy lifecycle UI:
  - Policy list with status badges (Draft/Published/Inactive)
  - Create Draft, Publish, Republish actions
  - Policy detail with role editor, conditional rules builder
- **Policy Tester** — form with user/permission/resource inputs, shows decision result
- **YAML Import/Export** — buttons in toolbar

---

## Soundcheck Deepening

### Architecture

The current scaffold has: basic types, simple rule evaluator (field + operator + value), fact scheduler, 7 collectors, basic table UI. Portal has a no-code builder, 23+ operators, 4 path resolvers, exemptions, insights dashboards, badges, and import/export.

### Check Engine Enhancements (Backend)

#### Operators — Full Set (23+)

**Current (11):** equal, notEqual, greaterThan, lessThan, greaterThanOrEqual, lessThanOrEqual, contains, notContains, matches, exists, notExists

**Add:**

Semver (9): `semverGt`, `semverGte`, `semverLt`, `semverLte`, `semverEq`, `semverNeq`, `semverSatisfies`, `semverGtr`, `semverLtr`
— Dependency: `semver` package

Date (2): `after`, `before`
— Support `now` keyword and ISO 8601 durations (e.g., `-P1Y` for 1 year ago)

Array (5): `in`, `notIn`, `doesNotContain`, `hasLengthOf`
— `contains` already exists, add the rest

Array prefixes (3): `all:operator`, `any:operator`, `none:operator`
— Wraps any operator to apply to all/any/none elements of an array fact

Existence: `exists` already exists (true/false validation)

**Total: 30 operators**

#### Path Resolvers

Add resolver selection per check via `pathResolver` field:

| Resolver             | Package               | Use Case                            |
| -------------------- | --------------------- | ----------------------------------- |
| `jsonpath` (default) | `jsonpath-plus`       | Complex queries, wildcards, filters |
| `lodash`             | `lodash.get`          | Simple dot notation                 |
| `jmespath`           | `@metrichor/jmespath` | Projections, functions              |
| `jsonata`            | `jsonata`             | Complex transformations             |

Implement as a `PathResolverRegistry` with pluggable resolvers.

#### Liquid Templating

Messages (passedMessage, failedMessage) support Liquid templates:

- `{{ entity.metadata.name }}` — entity fields
- `{{ fact }}` — single fact data
- `{{ facts['factRef'] }}` — multi-fact access
- `{{ fact | json: 4 }}` — JSON formatting

Dependency: `liquidjs` package.

#### Check Exemptions

**New table: `soundcheck_exemptions`**

```sql
id          TEXT PRIMARY KEY
check_id    TEXT NOT NULL REFERENCES soundcheck_checks(id)
entity_ref  TEXT NOT NULL
reason      TEXT NOT NULL
granted_by  TEXT NOT NULL
granted_at  TIMESTAMP DEFAULT NOW()
revoked_at  TIMESTAMP
revoked_by  TEXT
status      TEXT DEFAULT 'active'  -- active | revoked
```

**Endpoints:**

- `GET /api/soundcheck/exemptions?checkId=&entityRef=`
- `POST /api/soundcheck/exemptions` — create exemption
- `POST /api/soundcheck/exemptions/:id/revoke` — soft-revoke
- `POST /api/soundcheck/exemptions/:id/restore` — un-revoke

Exempted entities show as "Exempt" status, not "Pass" or "Fail".

#### Check History & Retention

- Results stored with timestamp, configurable retention (default 120 days)
- Cleanup via `coreServices.scheduler` cron job
- Config:

```yaml
soundcheck:
  results:
    history:
      enable: true
      retentionTimeInDays: 120
      cleanupFrequencyCron: '0 0 0 * * *'
```

#### Boolean Logic in Rules

Support nested `all`, `any`, `not` combinators:

```yaml
rule:
  all:
    - factRef: scm:default/readme
      path: $.exists
      operator: equal
      value: true
    - any:
        - factRef: ci:default/pipeline
          path: $.status
          operator: equal
          value: success
        - factRef: ci:default/pipeline
          path: $.status
          operator: equal
          value: skipped
```

### Frontend Enhancements

#### No-Code Check Builder (4-step wizard)

**Step 1: Facts & Rules**

- Facts dropdown (populated from registered collectors)
- Path input with auto-complete from fact schema
- Operator dropdown (contextual — shows semver ops only for version fields)
- Value input (type-aware)
- Add Rule button, drag to reorder
- Boolean combinator selector (ALL / ANY / NOT)
- Nested rule groups

**Step 2: Filters**

- Kind multi-select (Component, API, System, etc.)
- Type multi-select
- Lifecycle multi-select
- Tags multi-select
- Exclude filters

**Step 3: Messages & Settings**

- Pass message with Liquid preview
- Fail message with Liquid preview
- Owner entity ref picker
- Schedule (cron or human duration)
- Warning mode toggle

**Step 4: Review & Test**

- YAML preview (read-only, copy button)
- Dry Run section: entity picker → Run Check → result with rule breakdown
- Fact Explorer: browse fact data for selected entity
- Save / Save as Draft buttons

#### Insights Dashboards

**Check Insights Page** (`/soundcheck/checks/:id/insights`):

- Current Status Card — donut/pie chart showing pass/fail/warning/exempt distribution
- Historical Status Card — line chart showing status distribution over time
- Entity table with current results, filterable by status
- Export to CSV button

**Track Insights Page** (`/soundcheck/tracks/:id/insights`):

- Certification distribution bar chart (per level)
- Historical certification trend line chart
- Entity list with certification level, pass rate

**Campaign Insights Page** (`/soundcheck/campaigns/:id/insights`):

- Progress toward target: progress bar per milestone
- Pass rate over time chart
- Days remaining indicator
- Entity breakdown table

All charts implemented as inline SVG — no external charting library.

#### Badge System

- Track definition includes optional `badge` per level with SVG content
- Default badges: Bronze (🥉), Silver (🥈), Gold (🥇) — rendered as styled chips
- Custom SVG badges stored as base64 in track YAML
- `SoundcheckEntityCard` renders achieved badges

#### Import/Export

- Toolbar buttons: "Import YAML", "Export YAML", "Export All", "Export CSV"
- Import dialog: file upload, schema validation, duplicate detection, partial failure reporting
- CSV export respects active filters, capped at 5000 entities with warning toast

#### Check Templates

- Templates page/tab with grid of pre-built check configurations
- Each template: name, description, preview of rules, "Use Template" button
- Built-in templates:
  - SCM Compliance (6 checks): README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, .gitignore, CODEOWNERS
  - GitLab Settings (6 checks): branch protection, MR approvals, CI pipeline, issue tracking, registry, wiki

### Cross-Cutting Concerns (Wave 1)

Both RBAC and Soundcheck deepening include:

1. **Tests** — integration tests with `startTestBackend`, frontend tests with `renderInTestApp`
2. **Permissions** — RBAC-aware endpoints in Soundcheck (use RBAC policy for write operations)
3. **Audit Events** — emit to `audit` topic on every mutation
4. **i18n** — translation refs for all UI strings
5. **Config declarations** — complete `config.d.ts` updates

## Quality Standards

Same as Phase 1 spec — all 10 non-negotiable standards apply to every change in this wave.
