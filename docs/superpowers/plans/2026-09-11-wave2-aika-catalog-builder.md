# Wave 2: AiKA Side Panel & Catalog Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform AI Assistant from a separate page into an integrated side panel (AiKA) with DOM context capture, plugin-aware suggestions, mode processors. Add Catalog Builder for bulk repository ingestion.

**Spec:** `docs/superpowers/specs/2026-09-11-wave2-aika-catalog-builder.md`

## Global Constraints

- Copyright headers: Apache 2.0, year 2026
- Tests: `startTestBackend`/`mockServices.*` for backend, `renderInTestApp`/`mockApis.*` for frontend
- Every write endpoint: RBAC permission check + audit event emission
- i18n: all new UI strings via `createTranslationRef`
- New frontend system: all UI via Blueprints

---

### Task 1: AiKA — Mode System Backend

**Files:**

- Create: `plugins/ai-assistant-backend/migrations/20260911_modes.js`
- Modify: `plugins/ai-assistant-backend/src/plugin.ts`
- Create: `plugins/ai-assistant-backend/src/service/ModeStore.ts`
- Create: `plugins/ai-assistant-backend/src/service/ProcessorPipeline.ts`
- Modify: `plugins/ai-assistant-backend/src/service/router.ts`

**Interfaces:**

- Consumes: Knex, AI Gateway backend
- Produces: Modes CRUD, processor pipeline, analytics

- [ ] **Step 1:** Create migration adding `ai_modes` table (id, name, description, instructions, visibility, owner_ref, processors JSONB, mcp_tools JSONB, model_override, max_steps, temperature, usage_count_30d, created_at, updated_at).

- [ ] **Step 2:** Create `ModeStore.ts` — CRUD for modes, analytics query (top 5 by usage in 30 days), visibility filtering (public + own private).

- [ ] **Step 3:** Create `ProcessorPipeline.ts` — orchestrates 6 processor types in order: context-management → classification → planning → (AI call) → answer-formatting → verification (with retries) → confidence-scoring. Each processor is a function that transforms the conversation context.

- [ ] **Step 4:** Add mode endpoints to router: `GET /modes`, `POST /modes`, `GET /modes/:id`, `PUT /modes/:id`, `DELETE /modes/:id`, `GET /modes/popular` (top 5).

- [ ] **Step 5:** Modify conversation message handler to accept `modeId` and `pageContext` in request body. Route through ProcessorPipeline when mode specified.

- [ ] **Step 6:** Write tests, commit.

---

### Task 2: AiKA — Side Panel Frontend (FAB + Panel)

**Files:**

- Create: `plugins/ai-assistant/src/components/AikaFab.tsx`
- Create: `plugins/ai-assistant/src/components/AikaSidePanel.tsx`
- Create: `plugins/ai-assistant/src/components/AikaMessageList.tsx`
- Create: `plugins/ai-assistant/src/components/AikaInput.tsx`
- Create: `plugins/ai-assistant/src/modules/aikaAppModule.tsx`
- Modify: `plugins/ai-assistant/src/alpha/plugin.tsx`
- Modify: `plugins/ai-assistant/src/index.ts`

**Interfaces:**

- Consumes: AI Assistant API, Signals for streaming
- Produces: FAB + Side Panel app-level module

- [ ] **Step 1:** Create `AikaFab.tsx` — circular button, fixed position bottom-right, draggable horizontally (HTML5 drag), snap to left or right edge, position saved in localStorage. Click toggles panel. Notification dot when new response.

- [ ] **Step 2:** Create `AikaSidePanel.tsx` — overlay panel, right side, 420px width, resizable. Header: mode selector, conversation picker, close button. Body: AikaMessageList. Footer: AikaInput. Slide-in animation.

- [ ] **Step 3:** Create `AikaMessageList.tsx` — scrollable chat messages. User messages: right-aligned, accent bg. AI messages: left-aligned, surface bg. Supports markdown rendering, code blocks. Auto-scroll to bottom.

- [ ] **Step 4:** Create `AikaInput.tsx` — textarea with send button, suggestion chips above (contextual), mode selector inline (`@mode-name` detection in input). Shift+Enter for newline, Enter to send.

- [ ] **Step 5:** Create `aikaAppModule.tsx` — `createFrontendModule` for `pluginId: 'app'` that registers the FAB and Panel at app root level. This ensures AiKA is available on every page.

- [ ] **Step 6:** Export the app module from `index.ts`. Wire into `alpha/plugin.tsx`.

- [ ] **Step 7:** Commit.

---

### Task 3: AiKA — DOM Context Capture & Plugin-Aware Suggestions

**Files:**

- Create: `plugins/ai-assistant/src/hooks/usePageContext.ts`
- Create: `plugins/ai-assistant/src/hooks/useSuggestions.ts`
- Create: `plugins/ai-assistant-node/src/suggestionsExtensionPoint.ts`
- Modify: `plugins/ai-assistant/src/components/AikaInput.tsx`

**Interfaces:**

- Consumes: React Router location, Backstage APIs
- Produces: Page context, contextual suggestions

- [ ] **Step 1:** Create `usePageContext.ts` — hook that extracts: current route path, entity ref (if on entity page via `useEntity` from catalog-react), TechDocs path (if on docs), page title. Returns `PageContext` object.

- [ ] **Step 2:** Create `useSuggestions.ts` — based on `PageContext`, returns contextual suggestion chips. Default suggestions per route pattern:

  - Entity page: "Summarize this component", "Show Soundcheck status", "List recent changes"
  - TechDocs: "Summarize this page", "Find related documentation"
  - Soundcheck: "Explain failing checks", "Suggest fixes for this entity"
  - Catalog: "Find services owned by my team"
  - Default: "What can you help me with?"

- [ ] **Step 3:** Add `suggestionsExtensionPoint` to `ai-assistant-node` — plugins can register their own suggestions per route pattern.

- [ ] **Step 4:** Wire `usePageContext` into `AikaSidePanel` — pass context with every message. Wire `useSuggestions` into `AikaInput` — render chips above input.

- [ ] **Step 5:** Commit.

---

### Task 4: AiKA — Mode Management Frontend

**Files:**

- Create: `plugins/ai-assistant/src/components/ModeSelector.tsx` (replace existing basic one)
- Create: `plugins/ai-assistant/src/components/ModeManager.tsx`
- Create: `plugins/ai-assistant/src/components/ModeEditor.tsx`
- Modify: `plugins/ai-assistant/src/api/AiAssistantClient.ts`

**Interfaces:**

- Consumes: AI Assistant modes API
- Produces: Mode selection, creation, management UI

- [ ] **Step 1:** Update `AiAssistantClient` with: `listModes()`, `getPopularModes()`, `createMode(mode)`, `updateMode(id, mode)`, `deleteMode(id)`.

- [ ] **Step 2:** Create `ModeSelector.tsx` — dropdown in panel header showing: "Default", separator, "Most Popular" section (top 5), separator, "My Modes" section, "Manage Modes..." link. Selecting a mode sets it for the conversation.

- [ ] **Step 3:** Create `ModeManager.tsx` — dialog showing all modes: My Modes tab, Popular tab, All Public tab. Create, Edit, Delete actions. Visibility toggle (private/public).

- [ ] **Step 4:** Create `ModeEditor.tsx` — form: name, description, instructions (multiline), visibility, model override dropdown, max steps slider, temperature slider, MCP tools multi-select. Processor config section (enable/disable each of 6 processors).

- [ ] **Step 5:** Commit.

---

### Task 5: Catalog Builder — Backend

**Files:**

- Create: `plugins/catalog-builder-backend/package.json`
- Create: `plugins/catalog-builder-backend/.eslintrc.js`
- Create: `plugins/catalog-builder-backend/config.d.ts`
- Create: `plugins/catalog-builder-backend/migrations/20260911_init.js`
- Create: `plugins/catalog-builder-backend/src/plugin.ts`
- Create: `plugins/catalog-builder-backend/src/service/router.ts`
- Create: `plugins/catalog-builder-backend/src/service/IngestionEngine.ts`
- Create: `plugins/catalog-builder-backend/src/database/JobStore.ts`
- Create: `plugins/catalog-builder-backend/src/index.ts`

**Interfaces:**

- Consumes: `@backstage/integration` (GitLab/Azure APIs), catalog-node, events-node
- Produces: Ingestion engine, job tracking, REST API

- [ ] **Step 1:** Create package with deps: backend-plugin-api, integration, catalog-client, config, errors, express-promise-router, knex.

- [ ] **Step 2:** Create migration: `catalog_builder_jobs` table (id, provider, organization, mode, status, total_repos, processed, succeeded, failed, errors JSONB, created_by, timestamps).

- [ ] **Step 3:** Create `JobStore.ts` — CRUD for ingestion jobs, progress updates.

- [ ] **Step 4:** Create `IngestionEngine.ts`:

  - `listProviders(config)` — reads from `integrations.gitlab` and `integrations.azure`
  - `listOrganizations(provider)` — GitLab: list groups, Azure: list projects
  - `listRepositories(provider, org)` — with `catalog-info.yaml` detection
  - `ingest(job)` — iterates repos, creates Location entities or Portal-managed entities
  - Uses `coreServices.scheduler` for async execution

- [ ] **Step 5:** Create router: `GET /providers`, `GET /organizations`, `GET /repositories`, `POST /ingest`, `GET /jobs/:id`.

- [ ] **Step 6:** Create plugin.ts, index.ts, config.d.ts.

- [ ] **Step 7:** Write tests, commit.

---

### Task 6: Catalog Builder — Frontend Wizard

**Files:**

- Create: `plugins/catalog-builder/package.json`
- Create: `plugins/catalog-builder/.eslintrc.js`
- Create: `plugins/catalog-builder/src/alpha/plugin.tsx`
- Create: `plugins/catalog-builder/src/api/CatalogBuilderClient.ts`
- Create: `plugins/catalog-builder/src/api/ref.ts`
- Create: `plugins/catalog-builder/src/components/IngestionWizard.tsx`
- Create: `plugins/catalog-builder/src/components/steps/ProviderStep.tsx`
- Create: `plugins/catalog-builder/src/components/steps/ModeStep.tsx`
- Create: `plugins/catalog-builder/src/components/steps/OrgStep.tsx`
- Create: `plugins/catalog-builder/src/components/steps/RepoStep.tsx`
- Create: `plugins/catalog-builder/src/components/steps/DetailsStep.tsx`
- Create: `plugins/catalog-builder/src/components/steps/ReviewStep.tsx`
- Create: `plugins/catalog-builder/src/index.ts`

**Interfaces:**

- Consumes: Catalog Builder REST API
- Produces: 6-step wizard frontend plugin

- [ ] **Step 1:** Create package with frontend-plugin deps.

- [ ] **Step 2:** Create `CatalogBuilderClient` — methods for all backend endpoints.

- [ ] **Step 3:** Create `IngestionWizard.tsx` — Stepper with 6 steps, shared state.

- [ ] **Step 4:** Create step components:

  - `ProviderStep` — cards for each configured provider with connection status
  - `ModeStep` — Portal-Managed vs YAML-Managed selection with descriptions
  - `OrgStep` — searchable list of orgs/groups with repo counts
  - `RepoStep` — checkbox list with select all, language/activity filters, catalog-info detection badges
  - `DetailsStep` — default kind, lifecycle, system, tags
  - `ReviewStep` — summary, progress bar during ingestion via Signals

- [ ] **Step 5:** Wire plugin as PageBlueprint at `/catalog-builder`.

- [ ] **Step 6:** Commit.

---

### Task 7: Wave 2 Wiring & Verification

**Files:**

- Modify: `packages/backend/src/index.ts`
- Modify: `packages/backend/package.json`
- Modify: `packages/app/src/App.tsx`
- Modify: `packages/app/package.json`

- [ ] **Step 1:** Backend: add `plugin-catalog-builder-backend`. AiKA app module doesn't need backend wiring (ai-assistant-backend already wired).

- [ ] **Step 2:** Frontend: add `plugin-catalog-builder` and AiKA app module to features.

- [ ] **Step 3:** `yarn tsc` — must be clean.

- [ ] **Step 4:** Run all modified package tests.

- [ ] **Step 5:** Commit.

---

## Post-Wave 2: What's Ready

| Component                | Status                                 |
| ------------------------ | -------------------------------------- |
| AiKA Side Panel          | ✅ FAB + overlay panel on every page   |
| AiKA DOM Context         | ✅ Page context sent with messages     |
| AiKA Suggestions         | ✅ Plugin-aware contextual prompts     |
| AiKA Mode Processors     | ✅ 6 processors in pipeline            |
| AiKA Mode Management     | ✅ Create, edit, share, discover modes |
| Catalog Builder Backend  | ✅ GitLab + Azure ingestion engine     |
| Catalog Builder Frontend | ✅ 6-step wizard with progress         |

**Next:** Wave 3 — Fleetshift + DevEx Metrics + Data Experience + Minor gaps
