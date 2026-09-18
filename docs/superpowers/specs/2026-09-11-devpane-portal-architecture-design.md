# DevPane Developer Portal — Master Architecture Design

## Overview

Build a full-featured internal developer portal on Backstage OSS with feature parity to Spotify Portal for Backstage, natively integrated with DevPane's stack: GitLab self-hosted (git.example.com), Kubernetes, JHelp, and Azure DevOps.

All features are implemented as Backstage plugins following the existing codebase patterns. The new frontend system is mandatory. GrowthBook OSS replaces Spotify's Confidence for feature flags/experimentation.

## Architectural Decisions

| Decision         | Choice                           | Rationale                                                             |
| ---------------- | -------------------------------- | --------------------------------------------------------------------- |
| Plugin structure | Backstage plugins in this repo   | Follow existing monorepo pattern; all 160+ existing plugins live here |
| Frontend system  | New frontend system only         | Portal requires it; it's the future of Backstage                      |
| Feature flags    | GrowthBook OSS integration       | Mature OSS platform with SDKs, not worth rebuilding Confidence        |
| AI Gateway       | Backstage backend plugin         | Keeps everything in one deployment; K8s handles scaling               |
| Database         | PostgreSQL (shared Backstage DB) | Per-plugin schemas via Knex migrations, existing pattern              |
| Auth             | GitLab OAuth primary + Azure AD  | Native to their stack                                                 |

## Existing Infrastructure (Already in Repo)

These are NOT built from scratch — they exist and are wired:

| Component             | Status   | Location                                                               |
| --------------------- | -------- | ---------------------------------------------------------------------- |
| MCP Actions Backend   | ✅ Wired | `plugins/mcp-actions-backend/` — Streamable HTTP, OAuth, named servers |
| Auditor Service       | ✅ Alpha | `coreServices.auditor` — event logging infrastructure                  |
| Events System         | ✅ Wired | `@backstage/plugin-events-backend` + EventsService                     |
| Signals System        | ✅ Wired | `@backstage/plugin-signals-backend` — WebSocket push                   |
| Notifications         | ✅ Wired | `@backstage/plugin-notifications-backend` — user/group/broadcast       |
| Permissions Framework | ✅ Wired | `@backstage/plugin-permission-backend`                                 |
| Catalog               | ✅ Wired | Full catalog with processors, providers, relations                     |
| Scaffolder            | ✅ Wired | With GitHub module, custom actions                                     |
| Search                | ✅ Wired | With catalog, TechDocs, explore collators                              |
| Kubernetes            | ✅ Wired | New frontend system                                                    |
| TechDocs              | ✅ Wired | Via legacy compat layer                                                |

## Plugin Package Matrix

Each feature module follows ADR011 naming. New packages to create:

### Sub-project 1: Foundation

Configure existing plugins for DevPane's stack. No new packages — configuration only.

### Sub-project 2: Governance

| Package                          | Type     | Purpose                                            |
| -------------------------------- | -------- | -------------------------------------------------- |
| `plugin-rbac`                    | Frontend | RBAC management UI (policy builder, tester, roles) |
| `plugin-rbac-backend`            | Backend  | RBAC policy engine, REST API, YAML import          |
| `plugin-rbac-common`             | Common   | Shared types, permission definitions               |
| `plugin-rbac-node`               | Node     | Extension point for custom policy providers        |
| `plugin-entity-overlays`         | Frontend | Overlay editor UI                                  |
| `plugin-entity-overlays-backend` | Backend  | Overlay storage, merge-on-read processor           |
| `plugin-entity-overlays-common`  | Common   | Overlay data model                                 |
| `plugin-audit-log`               | Frontend | Audit log viewer UI                                |
| `plugin-audit-log-backend`       | Backend  | Audit event capture, REST API with filtering       |
| `plugin-audit-log-common`        | Common   | Event types, query parameters                      |

### Sub-project 3: Soundcheck

| Package                                         | Type     | Purpose                                                            |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------ |
| `plugin-soundcheck`                             | Frontend | Checks, tracks, campaigns UI; entity card/tab; insights dashboards |
| `plugin-soundcheck-backend`                     | Backend  | Check engine, fact collection scheduler, certifications            |
| `plugin-soundcheck-common`                      | Common   | Check/track/campaign models, filter DSL, result types              |
| `plugin-soundcheck-node`                        | Node     | Fact collector extension point, custom check provider EP           |
| `plugin-soundcheck-backend-module-gitlab`       | Module   | GitLab fact collector                                              |
| `plugin-soundcheck-backend-module-kubernetes`   | Module   | K8s resource fact collector                                        |
| `plugin-soundcheck-backend-module-sonarqube`    | Module   | SonarQube quality facts                                            |
| `plugin-soundcheck-backend-module-azure-devops` | Module   | Azure DevOps pipeline/PR facts                                     |
| `plugin-soundcheck-backend-module-http`         | Module   | Generic HTTP endpoint collector                                    |
| `plugin-soundcheck-backend-module-jira`         | Module   | Jira issue facts                                                   |
| `plugin-soundcheck-backend-module-scm`          | Module   | Source code content analysis (regex, glob, JSON/YAML)              |

### Sub-project 4: AI Platform

| Package                                      | Type     | Purpose                                             |
| -------------------------------------------- | -------- | --------------------------------------------------- |
| `plugin-ai-gateway`                          | Frontend | Provider management UI, model configuration         |
| `plugin-ai-gateway-backend`                  | Backend  | Multi-provider proxy, model routing, usage tracking |
| `plugin-ai-gateway-common`                   | Common   | Provider types, model capabilities matrix           |
| `plugin-ai-gateway-node`                     | Node     | AI provider extension point                         |
| `plugin-ai-gateway-backend-module-anthropic` | Module   | Anthropic/Claude provider                           |
| `plugin-ai-gateway-backend-module-openai`    | Module   | OpenAI provider                                     |
| `plugin-ai-gateway-backend-module-ollama`    | Module   | Ollama (self-hosted) provider                       |
| `plugin-ai-gateway-backend-module-bedrock`   | Module   | AWS Bedrock provider                                |
| `plugin-ai-assistant`                        | Frontend | Chat UI, side panel, mode selector                  |
| `plugin-ai-assistant-backend`                | Backend  | RAG pipeline, conversation management, modes engine |
| `plugin-ai-assistant-common`                 | Common   | Message types, mode definitions                     |
| `plugin-ai-assistant-node`                   | Node     | Knowledge source extension point                    |
| `plugin-ai-explorer`                         | Frontend | Rules, skills, plugins management UI                |
| `plugin-ai-explorer-backend`                 | Backend  | Rule/skill indexing, marketplace registry           |
| `plugin-ai-explorer-common`                  | Common   | Rule/skill/plugin data models                       |

### Sub-project 5: Intelligence & Automation

| Package                                            | Type     | Purpose                                                       |
| -------------------------------------------------- | -------- | ------------------------------------------------------------- |
| `plugin-devex-metrics`                             | Frontend | DORA dashboards, AI usage, metric overlay, segmentation       |
| `plugin-devex-metrics-backend`                     | Backend  | Metric collection, aggregation, survey engine                 |
| `plugin-devex-metrics-common`                      | Common   | Metric types, survey definitions                              |
| `plugin-devex-metrics-backend-module-gitlab`       | Module   | GitLab CI/CD and MR metrics collector                         |
| `plugin-devex-metrics-backend-module-azure-devops` | Module   | Azure DevOps pipeline metrics                                 |
| `plugin-insights`                                  | Frontend | Adoption analytics, feature usage, search analytics           |
| `plugin-insights-backend`                          | Backend  | Usage event tracking, analytics aggregation                   |
| `plugin-fleetshift`                                | Frontend | Shift management UI, PR dashboard                             |
| `plugin-fleetshift-backend`                        | Backend  | Shift execution engine, AI agent orchestration                |
| `plugin-fleetshift-common`                         | Common   | Shift types, execution state machine                          |
| `plugin-fleetshift-node`                           | Node     | Shift provider extension point                                |
| `plugin-fleetshift-backend-module-gitlab`          | Module   | GitLab MR creation, CI runner execution                       |
| `plugin-fleetshift-backend-module-azure-devops`    | Module   | Azure DevOps PR creation                                      |
| `plugin-template-editor`                           | Frontend | Visual template editor (form builder, action config, dry run) |

### Sub-project 6: Ecosystem

| Package                          | Type     | Purpose                                             |
| -------------------------------- | -------- | --------------------------------------------------- |
| `plugin-data-experience`         | Frontend | Dataset discovery, metadata management UI           |
| `plugin-data-experience-backend` | Backend  | Warehouse connectors, dataset registry              |
| `plugin-data-experience-common`  | Common   | Dataset entity model                                |
| `plugin-data-experience-node`    | Node     | Warehouse connector extension point                 |
| `plugin-growthbook`              | Frontend | Feature flag management UI (wraps GrowthBook)       |
| `plugin-growthbook-backend`      | Backend  | GrowthBook API proxy, flag sync                     |
| `plugin-skill-exchange`          | Frontend | Gig marketplace UI (mentor, pair, hack, embed)      |
| `plugin-skill-exchange-backend`  | Backend  | Gig matching, notifications                         |
| `plugin-skill-exchange-common`   | Common   | Gig types, skill models                             |
| `plugin-home-customizer`         | Frontend | Admin-controlled homepage layout with drag-and-drop |

## Shared Infrastructure Design

### Database Schema Strategy

Each plugin gets its own schema prefix, managed by Knex migrations:

```
backstage_rbac_*         — RBAC policies, roles, members
backstage_overlays_*     — Entity overlay storage
backstage_audit_*        — Audit events
backstage_soundcheck_*   — Checks, tracks, campaigns, facts, results, certifications
backstage_ai_gateway_*   — Provider configs, usage logs
backstage_ai_assistant_* — Conversations, modes, knowledge index
backstage_devex_*        — Metrics, surveys, responses
backstage_insights_*     — Usage events, analytics
backstage_fleetshift_*   — Shifts, executions, PR tracking
backstage_data_exp_*     — Dataset registry, access requests
backstage_skill_*        — Gigs, skills, matches
```

### Cross-Plugin Communication

```
Plugin A → EventsService → Plugin B    (async, topic-based)
Plugin A → SignalsService → Frontend    (WebSocket push)
Plugin A → ServiceRef → Plugin B API    (sync, DI-injected)
Plugin A → MCP Actions → AI Agent      (external AI tools)
```

### Authentication Flow

```
User → GitLab OAuth → Backstage Auth → Session Token
       ↓
       GitLab groups → Backstage Groups → RBAC Policy → Permissions
```

Azure AD as secondary provider for users in Azure DevOps ecosystem.

### AI Architecture

```
┌─────────────────────────────────────────┐
│              AI Assistant               │
│  (RAG, Modes, Conversation Management)  │
├─────────────┬───────────────────────────┤
│  Knowledge  │    MCP Actions Backend    │
│  Sources    │  (existing in repo)       │
│  - TechDocs │  ┌──────────────────────┐ │
│  - Catalog  │  │ Registered Tools:    │ │
│  - K8s      │  │ - Catalog CRUD       │ │
│  - GitLab   │  │ - Scaffolder Actions │ │
│  - Search   │  │ - Soundcheck Queries │ │
│             │  │ - Fleetshift Exec    │ │
│             │  │ - Search             │ │
│             │  └──────────────────────┘ │
├─────────────┴───────────────────────────┤
│            AI Gateway                    │
│  (Provider Management, Model Routing)    │
│  Anthropic │ OpenAI │ Ollama │ Bedrock   │
└──────────────────────────────────────────┘
```

### Soundcheck Architecture

```
┌───────────────────────────────────────────┐
│           Soundcheck Frontend             │
│  Checks UI │ Tracks UI │ Campaigns │ Insights │
├───────────────────────────────────────────┤
│           Soundcheck Backend              │
│  ┌─────────────┐  ┌──────────────────┐   │
│  │ Check Engine │  │ Certification    │   │
│  │ - Rules eval │  │ - Level tracking │   │
│  │ - Fact match │  │ - Badge system   │   │
│  │ - Results    │  │ - History        │   │
│  └─────────────┘  └──────────────────┘   │
│  ┌──────────────────────────────────────┐ │
│  │ Fact Collection Scheduler            │ │
│  │  ┌────────┐ ┌──────┐ ┌───────────┐  │ │
│  │  │ GitLab │ │ K8s  │ │ SonarQube │  │ │
│  │  └────────┘ └──────┘ └───────────┘  │ │
│  │  ┌──────┐ ┌──────┐ ┌──────┐        │ │
│  │  │ ADO  │ │ HTTP │ │ Jira │        │ │
│  │  └──────┘ └──────┘ └──────┘        │ │
│  │  ┌──────┐                           │ │
│  │  │ SCM  │ (source code analysis)    │ │
│  │  └──────┘                           │ │
│  └──────────────────────────────────────┘ │
├───────────────────────────────────────────┤
│  Extension Point: soundcheck.factCollectors │
│  (modules register via createBackendModule) │
└───────────────────────────────────────────┘
```

### Fleetshift Architecture (GitLab-native)

```
┌─────────────────────────────────────┐
│         Fleetshift Frontend         │
│  Create Shift │ PR Dashboard │ Status │
├─────────────────────────────────────┤
│         Fleetshift Backend          │
│  ┌───────────────────────────────┐  │
│  │ Shift Engine                  │  │
│  │ - Natural language → AI plan  │  │
│  │ - Clone repo per target      │  │
│  │ - Apply transformation       │  │
│  │ - Create MR on GitLab        │  │
│  │ - Track MR status            │  │
│  └───────────────────────────────┘  │
│  Execution: K8s Jobs (parallel)     │
│  AI: via AI Gateway                 │
│  SCM: GitLab API + Azure DevOps API │
├─────────────────────────────────────┤
│  Extension Point: fleetshift.providers │
│  (GitLab module, ADO module)          │
└─────────────────────────────────────┘
```

## Sub-Project Dependencies

```
Sub-project 1: Foundation
    ↓ (no new packages, only config)
Sub-project 2: Governance
    ↓ (RBAC, Overlays, Audit needed by everything above)
Sub-project 3: Soundcheck
    ↓ (needs RBAC for permissions, Overlays for entity decoration)
Sub-project 4: AI Platform
    ↓ (needs MCP backend (exists), AI Gateway for models)
Sub-project 5: Intelligence
    ↓ (needs Soundcheck for quality gates, AI Gateway for Fleetshift)
Sub-project 6: Ecosystem
    (needs RBAC, can use Soundcheck for data quality)
```

Sub-projects 3-6 can run in parallel after 1+2 complete, with noted dependencies.

## Quality Standards

Every plugin follows these non-negotiable standards:

1. **Full test coverage** — backend: integration tests with `TestBackend`, frontend: `renderInTestApp`
2. **API reports** — `yarn build:api-reports` passes
3. **Type safety** — `yarn tsc` clean, no `any` escapes
4. **Permissions** — every write operation behind a permission check
5. **Audit logging** — every state mutation emits an audit event
6. **i18n** — all UI strings through translation framework
7. **Config declarations** — every config field in `config.d.ts` with `@visibility`
8. **Changesets** — proper changeset for every published package change
9. **New frontend system** — all frontend via Blueprints, no old system
10. **RBAC integration** — every feature respects RBAC policies

## Implementation Approach

Each sub-project follows the same cycle:

1. Detailed spec (from portal-specs/ research)
2. Implementation plan (writing-plans skill)
3. TDD implementation (test-driven-development skill)
4. Code review (pr-review-toolkit)
5. Integration testing
6. Next sub-project

Start with Sub-project 1: Foundation.
