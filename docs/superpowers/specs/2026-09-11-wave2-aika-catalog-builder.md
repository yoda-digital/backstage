# Wave 2: AiKA Side Panel & Catalog Builder — Design Spec

## Overview

Transform the AI Assistant from a separate page into an integrated side panel (AiKA), and add Catalog Builder for bulk repository ingestion. These two features are the highest-impact UX improvements after governance (Wave 1).

## AiKA Side Panel

### Architecture

The current AI Assistant is a full-page chat. Portal's AiKA is an integrated side panel accessible from any page via a floating action button (FAB). This requires a fundamentally different frontend architecture.

### Components

#### 1. Floating Action Button (FAB)

- Rendered at app root level (not per-page)
- Draggable horizontally, snaps to bottom-left or bottom-right
- Position persisted in `localStorage`
- Click toggles the side panel
- Shows notification dot when AiKA has a response pending
- Registered as an app-level extension via `createFrontendModule`

#### 2. Side Panel

- Overlays the right side of the page (not pushes content)
- Width: 420px desktop, full-width mobile
- Resizable via drag handle on left edge
- Header: mode selector, conversation picker, close button
- Body: scrollable message list
- Footer: input area with plugin-aware suggestions

#### 3. DOM Context Capture

When the panel opens or user sends a message:

- Capture current page's route path
- Extract entity context if on an entity page (`useEntity` if available)
- Extract TechDocs content if on a docs page
- Send as `pageContext` field with each message to backend

```ts
interface PageContext {
  route: string;
  entityRef?: string;
  entityKind?: string;
  entityType?: string;
  techDocsPath?: string;
  pageTitle: string;
}
```

#### 4. Plugin-Aware Suggestions

Based on `pageContext.route`, show contextual quick-action chips:

- On entity page: "Summarize this component", "Show recent incidents", "Check Soundcheck status"
- On TechDocs: "Summarize this page", "Find related docs"
- On Soundcheck: "Explain failing checks", "Suggest fixes"
- On Catalog: "Find services owned by my team"

Suggestions registered via an extension point — plugins contribute their own suggestions.

#### 5. Mode System with Processors

**Mode definition:**

```ts
interface AiMode {
  id: string;
  name: string;
  description: string;
  instructions: string;
  visibility: 'private' | 'public';
  ownerRef: string;
  processors: AiProcessor[];
  mcpTools?: string[];
  modelOverride?: string;
  maxSteps?: number;
  temperature?: number;
}
```

**6 Processor types:**

| Processor            | Purpose                                                 | When             |
| -------------------- | ------------------------------------------------------- | ---------------- |
| `classification`     | Categorize request (how-to, operational, lookup)        | Before tool use  |
| `planning`           | Generate investigation plan                             | Before tool use  |
| `answer-formatting`  | Enforce response structure                              | After response   |
| `verification`       | Review response against criteria, retry if needed       | After response   |
| `confidence-scoring` | Rate as low/medium/high                                 | After response   |
| `context-management` | Manage conversation history (token limits, compression) | Before each turn |

Each processor can use a different model for cost optimization.

**Backend changes to AI Assistant:**

- New table `ai_modes` for mode storage
- Mode CRUD endpoints
- Processor pipeline in response generation
- Mode analytics tracking (30-day usage for "Most Popular")

**Frontend:**

- Mode selector dropdown in panel header
- "Manage Modes" dialog with create/edit/visibility controls
- Most Popular section showing top 5 modes
- Direct invocation via `@mode-name` prefix in chat input

### Data Flow

```
User types message
  → Frontend captures pageContext
  → POST /api/ai-assistant/conversations/:id/messages
    { content, pageContext, modeId }
  → Backend runs processor pipeline:
    1. context-management (trim/compress history)
    2. classification (categorize request)
    3. planning (generate investigation plan)
    4. AI Gateway call with mode instructions + tools
    5. answer-formatting (structure response)
    6. verification (check quality, retry if needed)
    7. confidence-scoring (rate confidence)
  → Response streamed back via Signals WebSocket
  → Frontend renders in panel
```

### Frontend Plugin Changes

The `plugin-ai-assistant` transforms from a standalone page plugin to:

- **App-level module** registering the FAB and panel at root
- **Page** still exists at `/ai-assistant` for full-screen mode
- **Entity card** showing recent AiKA conversations about the entity

Package changes: add dep on `@backstage/plugin-signals-react` for WebSocket streaming.

---

## Catalog Builder

### Architecture

New plugin pair that provides a multi-step wizard for bulk repository ingestion into the Backstage catalog.

### Packages

| Package                          | Purpose                  |
| -------------------------------- | ------------------------ |
| `plugin-catalog-builder`         | Frontend wizard UI       |
| `plugin-catalog-builder-backend` | Backend ingestion engine |

### Backend

#### Ingestion Engine

Connects to SCM providers (GitLab, Azure DevOps) to:

1. List organizations/groups
2. List repositories in selected org/group
3. Detect existing `catalog-info.yaml` files
4. Create entities in catalog (Portal-managed or YAML-managed)

#### Management Modes

**Portal-Managed:**

- Backend creates `Location` entities pointing to each repo
- Generates minimal entity metadata from repo info (name, description, language)
- No `catalog-info.yaml` file needed in the repo
- Metadata stored as Entity Overlays

**YAML-Managed:**

- Backend creates PRs/MRs with `catalog-info.yaml` in each repo
- Uses Scaffolder actions for MR creation (existing GitLab/Azure modules)
- Or creates Location entities pointing to existing `catalog-info.yaml`

#### Endpoints

- `GET /api/catalog-builder/providers` — list configured SCM providers
- `GET /api/catalog-builder/organizations?provider=` — list orgs/groups
- `GET /api/catalog-builder/repositories?provider=&org=` — list repos with catalog-info detection
- `POST /api/catalog-builder/ingest` — execute bulk ingestion
- `GET /api/catalog-builder/jobs/:id` — check ingestion job status

#### Database

**Table: `catalog_builder_jobs`**

```sql
id          TEXT PRIMARY KEY
provider    TEXT NOT NULL
organization TEXT NOT NULL
mode        TEXT NOT NULL  -- portal-managed | yaml-managed
status      TEXT DEFAULT 'pending'
total_repos INTEGER
processed   INTEGER DEFAULT 0
succeeded   INTEGER DEFAULT 0
failed      INTEGER DEFAULT 0
errors      JSONB DEFAULT '[]'
created_by  TEXT NOT NULL
created_at  TIMESTAMP DEFAULT NOW()
completed_at TIMESTAMP
```

### Frontend — Multi-Step Wizard

**Step 1: Provider Selection**

- Cards for each configured provider (GitLab, Azure DevOps)
- Shows connection status (authenticated/not)

**Step 2: Mode Selection**

- Portal-Managed vs YAML-Managed
- Description of each mode's behavior
- Recommendation based on org size

**Step 3: Organization Selection**

- Searchable list of orgs/groups from selected provider
- Shows repo count per org

**Step 4: Repository Selection**

- Checkbox list of repositories
- "Select All" / "Deselect All"
- Shows which repos already have catalog-info.yaml
- Filter by language, activity, name
- Shows estimated entity count

**Step 5: Details (optional)**

- Default entity kind (Component)
- Default lifecycle (production/experimental)
- Default system assignment
- Tag assignment

**Step 6: Review & Ingest**

- Summary: X repos, Y entities, mode, provider
- Estimated time
- "Start Ingestion" button
- Progress bar with real-time updates via Signals

### Integration Points

- Uses `@backstage/integration` for GitLab/Azure DevOps API access
- Uses existing catalog-backend APIs for entity creation
- Uses Entity Overlays for Portal-managed metadata
- Uses Scaffolder for YAML-managed MR creation
- Emits audit events for every ingestion job

### Config

```yaml
catalogBuilder:
  providers:
    gitlab:
      host: git.example.com
    azure:
      organization: example
```

Uses integration credentials from `integrations.gitlab` and `integrations.azure`.

## Cross-Cutting Concerns (Wave 2)

1. **Tests** — integration tests for ingestion engine, frontend tests for wizard steps
2. **Permissions** — catalog-builder behind RBAC (admin-only by default)
3. **Audit Events** — emit on ingestion start/complete/fail
4. **i18n** — all wizard strings through translation framework
