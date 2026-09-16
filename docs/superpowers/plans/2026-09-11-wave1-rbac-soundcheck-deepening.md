# Wave 1: RBAC & Soundcheck Deepening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deepen RBAC from basic CRUD to full policy lifecycle with conditional rules and tester. Deepen Soundcheck from basic tables to no-code builder with 30 operators, path resolvers, exemptions, insights charts, badges, and import/export.

**Spec:** `docs/superpowers/specs/2026-09-11-wave1-rbac-soundcheck-deepening.md`

## Global Constraints

- Modify existing packages — no new packages created (except potentially `plugin-catalog-builder` in Wave 2)
- Copyright headers on all new `.ts` files (Apache 2.0, year 2026)
- All backend changes tested with `startTestBackend` / `mockServices.*`
- All frontend changes tested with `renderInTestApp` / `mockApis.*`
- Every write endpoint: RBAC permission check + audit event emission
- i18n: all new UI strings via `createTranslationRef`
- Config: every new config field in `config.d.ts` with `@visibility`

---

### Task 1: RBAC — Policy Lifecycle Database & Store

**Files:**

- Create: `plugins/rbac-backend/migrations/20260911_policies.js`
- Modify: `plugins/rbac-backend/src/database/RbacStore.ts`

**Interfaces:**

- Consumes: existing Knex database client
- Produces: `rbac_policies` table, `rbac_conditional_rules` table, CRUD methods for policies

- [ ] **Step 1:** Create migration `20260911_policies.js` adding `rbac_policies` table (id, name, status, strategy, rules JSONB, timestamps) and `rbac_conditional_rules` table (id, name, description, resource_type, params_schema JSONB, plugin_id). Add `policy_id` column to `rbac_roles`.

- [ ] **Step 2:** Add to `RbacStore`: `createPolicy(policy)`, `getPolicy(id)`, `listPolicies()`, `updatePolicy(id, patch)`, `publishPolicy(id)` (sets status=published, current published→inactive), `republishPolicy(id)` (clones inactive→draft). Add `listConditionalRules()`, `addConditionalRule(rule)`.

- [ ] **Step 3:** Write tests: `CI=1 yarn test plugins/rbac-backend`

- [ ] **Step 4:** Commit

---

### Task 2: RBAC — Resolution Strategies & Conditional Rules

**Files:**

- Modify: `plugins/rbac-backend/src/service/policy.ts`
- Create: `plugins/rbac-backend/src/service/conditionalRules.ts`

**Interfaces:**

- Consumes: `RbacStore` with new policy methods
- Produces: Enhanced `RbacPermissionPolicy` with strategy support, built-in conditional rules

- [ ] **Step 1:** Refactor `RbacPermissionPolicy.handle()` to: load active (published) policy, apply strategy (first-match or any-allow), evaluate conditional rules against resource.

- [ ] **Step 2:** Create `conditionalRules.ts` with built-in rules: `IS_ENTITY_OWNER` (checks if user is in entity ownershipEntityRefs), `HAS_ANNOTATION` (checks entity annotation exists with optional value), `HAS_TAG`, `HAS_LABEL`, `IN_SYSTEM`. Each implements `PermissionRule` from `@backstage/plugin-permission-node`.

- [ ] **Step 3:** Register rules via `createPermissionIntegrationRouter` in plugin init.

- [ ] **Step 4:** Write tests, commit.

---

### Task 3: RBAC — Policy Tester & YAML Import/Export

**Files:**

- Modify: `plugins/rbac-backend/src/service/router.ts`

**Interfaces:**

- Consumes: `RbacPermissionPolicy`, `RbacStore`
- Produces: Test endpoint, export/import endpoints

- [ ] **Step 1:** Add `POST /policies/:id/test` — accepts `{ userRef, permission, resourceRef }`, evaluates using the specified policy (not necessarily the published one), returns `{ decision, matchedRole, matchedRule, evaluationChain }`.

- [ ] **Step 2:** Add `GET /policies/:id/export` — serializes policy as YAML (roles, bindings, rules, strategy).

- [ ] **Step 3:** Add `POST /policies/import` — accepts YAML body, validates schema, creates as Draft policy.

- [ ] **Step 4:** Add policy lifecycle endpoints: `POST /policies` (create draft), `POST /policies/:id/publish`, `POST /policies/:id/republish`.

- [ ] **Step 5:** Write tests, commit.

---

### Task 4: RBAC — Frontend Policy Management

**Files:**

- Modify: `plugins/rbac/src/components/RolesPage.tsx` → rename to `PolicyPage.tsx`
- Create: `plugins/rbac/src/components/PolicyList.tsx`
- Create: `plugins/rbac/src/components/PolicyEditor.tsx`
- Create: `plugins/rbac/src/components/PolicyTester.tsx`
- Create: `plugins/rbac/src/components/ConditionalRuleBuilder.tsx`
- Modify: `plugins/rbac/src/api/RbacClient.ts`
- Modify: `plugins/rbac/src/alpha.tsx`

**Interfaces:**

- Consumes: Updated RBAC REST API
- Produces: Full policy management UI

- [ ] **Step 1:** Update `RbacClient` with: `listPolicies()`, `createPolicy()`, `publishPolicy()`, `republishPolicy()`, `testPolicy()`, `exportPolicy()`, `importPolicy()`.

- [ ] **Step 2:** Create `PolicyList.tsx` — table showing policies with Status badge (Draft=blue, Published=green, Inactive=gray), actions (Edit, Publish, Export, Delete).

- [ ] **Step 3:** Create `PolicyEditor.tsx` — edit roles within a policy, add permission decisions with conditional rule builder. Shows resolution strategy selector.

- [ ] **Step 4:** Create `ConditionalRuleBuilder.tsx` — dropdown of available rules (IS_ENTITY_OWNER, etc.), params form based on rule's params_schema.

- [ ] **Step 5:** Create `PolicyTester.tsx` — form with user ref input, permission selector, entity ref input. Submit button, result display showing decision chain.

- [ ] **Step 6:** Wire into `alpha.tsx` — replace old RolesPage with PolicyPage containing tabs: Policies, Tester, Import/Export.

- [ ] **Step 7:** Commit.

---

### Task 5: Soundcheck — Check Engine Operators

**Files:**

- Modify: `plugins/soundcheck-backend/src/engine/CheckEngine.ts`
- Create: `plugins/soundcheck-backend/src/engine/operators.ts`
- Create: `plugins/soundcheck-backend/src/engine/pathResolvers.ts`

**Interfaces:**

- Consumes: SoundcheckRule, SoundcheckFact
- Produces: Full operator set (30), path resolver registry

- [ ] **Step 1:** Create `operators.ts` — export `evaluateOperator(operator, factValue, ruleValue): boolean`. Implement all 30 operators: existing 11 + semver 9 (`semver` package) + date 2 (ISO 8601 parse, `now` keyword) + array 5 + array prefixes 3. Each operator is a pure function.

- [ ] **Step 2:** Create `pathResolvers.ts` — export `resolvePath(resolver, data, path)`. Implement 4 resolvers: `jsonpath` (`jsonpath-plus`), `lodash` (`lodash.get`), `jmespath` (`@metrichor/jmespath`), `jsonata` (`jsonata`). Default: `jsonpath`.

- [ ] **Step 3:** Refactor `CheckEngine.evaluate()` to use `evaluateOperator()` and `resolvePath()`. Support nested boolean logic (`all`/`any`/`not` combinators).

- [ ] **Step 4:** Add dependencies to `plugins/soundcheck-backend/package.json`: `semver`, `jsonpath-plus`, `lodash.get`, `@metrichor/jmespath`, `jsonata`, `liquidjs`.

- [ ] **Step 5:** Create `plugins/soundcheck-backend/src/engine/messageRenderer.ts` — Liquid template renderer for pass/fail messages with entity + fact context.

- [ ] **Step 6:** Write operator tests (one per operator), path resolver tests, message renderer tests.

- [ ] **Step 7:** Commit.

---

### Task 6: Soundcheck — Exemptions & History

**Files:**

- Create: `plugins/soundcheck-backend/migrations/20260911_exemptions.js`
- Modify: `plugins/soundcheck-backend/src/database/SoundcheckStore.ts`
- Modify: `plugins/soundcheck-backend/src/service/router.ts`

**Interfaces:**

- Consumes: Knex client
- Produces: Exemptions table, CRUD endpoints, history retention

- [ ] **Step 1:** Create migration adding `soundcheck_exemptions` table (id, check_id, entity_ref, reason, granted_by, granted_at, revoked_at, revoked_by, status).

- [ ] **Step 2:** Add to `SoundcheckStore`: `createExemption()`, `revokeExemption()`, `restoreExemption()`, `listExemptions(filter)`, `isExempt(checkId, entityRef)`.

- [ ] **Step 3:** Add to router: `GET /exemptions`, `POST /exemptions`, `POST /exemptions/:id/revoke`, `POST /exemptions/:id/restore`.

- [ ] **Step 4:** Modify check evaluation to check exemption status — if exempt, result is `{ status: 'exempt' }` instead of evaluating.

- [ ] **Step 5:** Add history cleanup: register scheduler task that deletes results older than `retentionTimeInDays` (config, default 120).

- [ ] **Step 6:** Add `soundcheck.results.history` to `config.d.ts`.

- [ ] **Step 7:** Write tests, commit.

---

### Task 7: Soundcheck — No-Code Check Builder Frontend

**Files:**

- Create: `plugins/soundcheck/src/components/CheckBuilder/CheckBuilderWizard.tsx`
- Create: `plugins/soundcheck/src/components/CheckBuilder/FactSelector.tsx`
- Create: `plugins/soundcheck/src/components/CheckBuilder/RuleBuilder.tsx`
- Create: `plugins/soundcheck/src/components/CheckBuilder/FilterEditor.tsx`
- Create: `plugins/soundcheck/src/components/CheckBuilder/ReviewAndTest.tsx`
- Create: `plugins/soundcheck/src/components/CheckBuilder/FactExplorer.tsx`
- Modify: `plugins/soundcheck/src/components/SoundcheckPage.tsx`
- Modify: `plugins/soundcheck/src/api/SoundcheckClient.ts`

**Interfaces:**

- Consumes: Soundcheck REST API
- Produces: 4-step check creation wizard

- [ ] **Step 1:** Create `CheckBuilderWizard.tsx` — Stepper with 4 steps, state management for check definition.

- [ ] **Step 2:** Create `FactSelector.tsx` — dropdown of registered fact refs (from `GET /facts/collectors`), path input, operator selector (contextual — shows semver ops for version fields), value input.

- [ ] **Step 3:** Create `RuleBuilder.tsx` — visual tree builder for all/any/not boolean combinators. Each leaf is a FactSelector. Add/remove rules, drag to reorder. Nested groups.

- [ ] **Step 4:** Create `FilterEditor.tsx` — multi-select dropdowns for kind, type, lifecycle, tags. Exclude section.

- [ ] **Step 5:** Create `ReviewAndTest.tsx` — YAML preview (read-only textarea with copy button), Dry Run section (entity picker, Run Check button, result display with rule breakdown), Fact Explorer (fact ref + entity ref → shows fetched data).

- [ ] **Step 6:** Create `FactExplorer.tsx` — standalone panel for browsing fact data. Fact ref input, path input, entity picker, fetch button, JSON viewer.

- [ ] **Step 7:** Wire into `SoundcheckPage.tsx` — "Create Check" button opens wizard dialog. Edit button on existing checks opens wizard pre-populated.

- [ ] **Step 8:** Update `SoundcheckClient` with: `dryRunCheck(checkDef, entityRef)`, `getFactCollectors()`, `exploreFact(factRef, entityRef, path)`, `importChecks(yaml)`, `exportChecks(ids)`, `exportChecksCsv(checkId, filters)`.

- [ ] **Step 9:** Commit.

---

### Task 8: Soundcheck — Insights Dashboards

**Files:**

- Create: `plugins/soundcheck/src/components/Insights/CheckInsights.tsx`
- Create: `plugins/soundcheck/src/components/Insights/TrackInsights.tsx`
- Create: `plugins/soundcheck/src/components/Insights/CampaignInsights.tsx`
- Create: `plugins/soundcheck/src/components/Charts/DonutChart.tsx`
- Create: `plugins/soundcheck/src/components/Charts/LineChart.tsx`
- Create: `plugins/soundcheck/src/components/Charts/ProgressBar.tsx`
- Modify: `plugins/soundcheck/src/alpha.tsx` or `src/alpha/plugin.tsx`

**Interfaces:**

- Consumes: Soundcheck REST API aggregate endpoints
- Produces: Insights pages with charts

- [ ] **Step 1:** Create `DonutChart.tsx` — SVG donut chart component. Props: `data: Array<{label, value, color}>`, `size`, `title`. Responsive, theme-aware colors.

- [ ] **Step 2:** Create `LineChart.tsx` — SVG line chart. Props: `data: Array<{date, values: Record<string, number>}>`, `lines: Array<{key, color, label}>`, `overlay?`. X-axis: dates, Y-axis: auto-scaled. Hover tooltip.

- [ ] **Step 3:** Create `ProgressBar.tsx` — styled progress bar with label and percentage.

- [ ] **Step 4:** Create `CheckInsights.tsx` — page showing: DonutChart (current pass/fail/warning/exempt distribution), LineChart (historical trend), filterable entity table below. Backend endpoint: `GET /checks/:id/insights?from=&to=`.

- [ ] **Step 5:** Create `TrackInsights.tsx` — certification distribution per level (stacked bar), historical certification trend. Backend endpoint: `GET /tracks/:id/insights`.

- [ ] **Step 6:** Create `CampaignInsights.tsx` — ProgressBar per milestone, pass rate LineChart, days remaining badge. Backend endpoint: `GET /campaigns/:id/insights`.

- [ ] **Step 7:** Add insights endpoints to Soundcheck backend router.

- [ ] **Step 8:** Register insights pages as sub-routes in plugin alpha.

- [ ] **Step 9:** Commit.

---

### Task 9: Soundcheck — Badge System & Templates

**Files:**

- Modify: `plugins/soundcheck-common/src/types.ts`
- Modify: `plugins/soundcheck/src/components/EntitySoundcheckCard.tsx`
- Create: `plugins/soundcheck/src/components/BadgeDisplay.tsx`
- Create: `plugins/soundcheck/src/components/CheckTemplates.tsx`

**Interfaces:**

- Consumes: Track definitions with badge config
- Produces: Badge rendering, template library

- [ ] **Step 1:** Add `badge` field to `SoundcheckLevel` type: `{ svgContent?: string; emoji?: string; color?: string }`.

- [ ] **Step 2:** Create `BadgeDisplay.tsx` — renders badge as SVG (if custom) or styled chip with emoji (default: 🥉🥈🥇 for levels 1-3).

- [ ] **Step 3:** Update `EntitySoundcheckCard` to show certification badges per track.

- [ ] **Step 4:** Create `CheckTemplates.tsx` — grid of pre-built check configs. Each card: name, description, check count, "Use Template" button. Built-in: SCM Compliance (README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, .gitignore, CODEOWNERS) and GitLab Settings (branch protection, MR approvals, CI pipeline).

- [ ] **Step 5:** Wire templates into Check Builder — "Start from Template" option in wizard.

- [ ] **Step 6:** Commit.

---

### Task 10: Soundcheck — Import/Export & Cross-Cutting

**Files:**

- Modify: `plugins/soundcheck-backend/src/service/router.ts`
- Create: `plugins/soundcheck/src/components/ImportDialog.tsx`
- Modify: all Soundcheck backend routes for audit events + permission checks

**Interfaces:**

- Consumes: Soundcheck REST API, RBAC permissions, Events service
- Produces: YAML import/export, audit trail, i18n

- [ ] **Step 1:** Add YAML export endpoints: `GET /checks/export`, `GET /tracks/export`, `GET /campaigns/export`, `GET /checks/:id/export`. Return `application/yaml`.

- [ ] **Step 2:** Add YAML import endpoint: `POST /checks/import`, `POST /tracks/import`. Validate YAML schema, detect duplicate IDs, return partial failure report.

- [ ] **Step 3:** Add CSV export: `GET /checks/:id/entities/csv?status=&limit=5000`. Apply filters, cap at 5000 with header warning.

- [ ] **Step 4:** Create `ImportDialog.tsx` — file upload, validation display, duplicate warnings, import button.

- [ ] **Step 5:** Add RBAC permission checks to all Soundcheck write endpoints using `httpAuth.credentials()` + `permissions.authorize()`.

- [ ] **Step 6:** Add audit event emission to all Soundcheck mutations: `events.publish({ topic: 'audit', eventPayload: { action, actor, entityRef, metadata } })`.

- [ ] **Step 7:** Create `plugins/soundcheck/src/translation.ts` with `createTranslationRef`. Replace all hardcoded strings in Soundcheck frontend components.

- [ ] **Step 8:** Final verification: `yarn tsc`, `CI=1 yarn test plugins/soundcheck-backend`, `CI=1 yarn test plugins/rbac-backend`.

- [ ] **Step 9:** Commit.

---

## Post-Wave 1: What's Ready

| Component                       | Status                                                            |
| ------------------------------- | ----------------------------------------------------------------- |
| RBAC Policy Lifecycle           | ✅ Draft/Published/Inactive/Republish                             |
| RBAC Resolution Strategies      | ✅ First-Match + Any-Allow                                        |
| RBAC Conditional Rules          | ✅ IS_ENTITY_OWNER, HAS_ANNOTATION, HAS_TAG, HAS_LABEL, IN_SYSTEM |
| RBAC Policy Tester              | ✅ Live evaluation with decision chain                            |
| RBAC YAML Import/Export         | ✅ Full policy serialization                                      |
| Soundcheck 30 Operators         | ✅ Including semver, date, array                                  |
| Soundcheck Path Resolvers       | ✅ JSONPath, Lodash, JMESPath, JSONata                            |
| Soundcheck No-Code Builder      | ✅ 4-step wizard with dry run                                     |
| Soundcheck Exemptions           | ✅ CRUD with revoke/restore                                       |
| Soundcheck Insights             | ✅ Check/Track/Campaign dashboards                                |
| Soundcheck Badges               | ✅ Bronze/Silver/Gold + custom SVG                                |
| Soundcheck Templates            | ✅ SCM Compliance + GitLab Settings                               |
| Soundcheck Import/Export        | ✅ YAML + CSV                                                     |
| Cross-cutting: Tests            | ✅ Backend + frontend                                             |
| Cross-cutting: RBAC integration | ✅ Permission checks on writes                                    |
| Cross-cutting: Audit events     | ✅ All mutations logged                                           |
| Cross-cutting: i18n             | ✅ Translation refs                                               |

**Next:** Wave 2 — AiKA Side Panel + Catalog Builder
