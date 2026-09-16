# Spotify Portal — Analiză Vizuală Completă & Delta față de Implementarea Noastră

## FEATURES DESCOPERITE ÎN PORTAL (documentație + screenshots)

### 1. SOUNDCHECK — MULT mai complex decât ce am construit

**Ce are Portal-ul:**

- **No-code Check Builder UI** cu 4 tab-uri: Facts selection → Rules builder (all/any/not) → Filters → Review & Test
- **23+ operatori** (noi avem ~11): include `semverGt/Gte/Lt/Lte/Eq/Neq/Satisfies/Gtr/Ltr`, `after/before` (date), `in/notIn`, `contains/doesNotContain`, `hasLengthOf`, plus prefixe `all:/any:/none:` pe arrays
- **4 path resolvers**: JSONPath (default), Lodash Get, JMESPath, JSONata — noi avem doar field simplu
- **Check Templates** — grid de template-uri pre-built (GitHub Settings, SCM Compliance) cu 13+ checks ready-to-use
- **Dry Run** cu fact explorer — testează check-ul live pe o entitate, cu details modal care arată fact data + rule breakdown
- **Liquid templating** în mesaje — `{{ entity.metadata.name }}`, `{{ fact | json: 4 }}`
- **Check Exemptions** — CRUD complet cu revoke/restore
- **Manual Checks** — checks pushed via API, nu fact collectors
- **Multi-fact checks** — un check evaluează facts din surse multiple
- **Push Workflow** — facts submitted via API direct
- **Check History** — 120 zile retenție configurabilă, cu cleanup cron
- **Import/Export YAML** — import dialog cu validare, bulk export, CSV export (5000 entities cap)
- **Check Insights page** — Current Status Card + Historical Status Card cu trend charts
- **Track Insights** — aggregate certification status, history over time
- **Campaign Insights** — progress tracking cu milestones (pass rate 0-100%)
- **14 fact collectors** (noi avem 7): + BigQuery, Datadog, NewRelic, PagerDuty, Snyk, TechInsights, Data Registry, Catalog
- **Badge/Medal System** — Bronze/Silver/Gold SVG badges personalizabile per level
- **Gamification** — levels de la hardest la easiest, progression tracking
- **Notifications integration** — notifică pe Slack
- **Events integration** — emite events la changes
- **MCP Actions** — Soundcheck tools expuse pentru AI agents
- **Health monitoring** — job queue statistics, performance dashboard
- **Internationalization** — i18n built-in

**CE NE LIPSEȘTE CRITIC:**

- No-code UI builder (avem doar tabele)
- Operatori semver și date
- Path resolvers (JSONPath, JMESPath, JSONata)
- Check exemptions
- Dry run cu fact explorer
- Liquid templating
- Check/Track/Campaign Insights (charts)
- Badge/Medal system cu SVG
- 7 fact collectors lipsă (BigQuery, Datadog, NewRelic, PagerDuty, Snyk, TechInsights, Data Registry)
- Import/Export YAML flows
- Check templates

---

### 2. AiKA (AI Assistant) — Arhitectură diferită de ce am construit

**Ce are Portal-ul:**

- **Side Panel** — draggable FAB (floating action button), snap bottom-left/right, popover sau full panel
- **Plugin-aware suggestions** — pe TechDocs arată "Summarize this page", pe catalog arată entity-specific prompts
- **DOM capture** — capturează DOM-ul paginii curente ca context
- **Modes system cu 6 procesoare:**
  1. Classification — categorizează request-ul
  2. Planning — generează plan de investigare ÎNAINTE de tool use
  3. Answer formatting — forțează structură response
  4. Verification — re-evaluare cu retries (1-5 runde)
  5. Confidence scoring — low/medium/high
  6. Context management — token limits, memory compression
- **Mode Discovery** — "Most Popular" section, top 5 pe 30 zile
- **Direct invocation** — `@mode-name` syntax pentru single message
- **MCP Tools integration** — modes se conectează la MCP servers cu tool filtering
- **Visibility model** — private/public modes, ownership transfer la groups

**CE NE LIPSEȘTE CRITIC:**

- Side panel (avem pagină separată, nu panel integrat)
- DOM context capture
- Plugin-aware suggestions
- Cele 6 procesoare (classification, planning, formatting, verification, confidence, context)
- Mode discovery cu analytics
- Direct invocation via @syntax

---

### 3. FLEETSHIFT — Mult mai avansat

**Ce are Portal-ul:**

- **Agent mode** — AI analizează codul și generează transformări
- **NPM Package Shifts** — upgrade/migrate npm packages fleet-wide
- **OpenRewrite Shifts** — Java/Kotlin transformations via OpenRewrite
- **Multi-provider AI** — Claude Opus (recomandat), Claude Sonnet, GPT-5.5, GPT-5, GPT-4.1
- **Real-time logs** — Logs tab pe fiecare target
- **Diff preview** — Diff tab înainte de PR creation
- **4-step create flow**: Name → Prompt → PR Settings (branch, title, description) → Targets
- **Model selection per shift** — switch-able pe shifts existente

**CE NE LIPSEȘTE:**

- NPM package shift type
- OpenRewrite shift type
- Real-time logs tab
- Diff preview tab
- Model selection per shift

---

### 4. CATALOG BUILDER — Feature COMPLET NOU pe care nu l-am implementat

**Ce are Portal-ul:**

- **Bulk ingestion wizard** — onboard multiple repos simultan
- **3 source control providers** — GitHub, GitLab, Azure DevOps
- **2 management modes:**
  - Portal-Managed — Portal creează metadata, fără catalog-info.yaml
  - YAML-Managed — metadata în repo, Portal sincronizează
- **Multi-step wizard** — provider → mode → organization → repositories → details → review
- **Auto-ingestion** — bulk import cu entity creation

**CE NE LIPSEȘTE:** Totul — nu avem Catalog Builder. E o feature majoră.

---

### 5. RBAC — Mai sofisticat

**Ce are Portal-ul:**

- **Policy Lifecycle** — Draft → Published → Inactive → Republish
- **Single active policy** — doar o politică publicată la un moment
- **2 resolution strategies** — First-Match (ordered) vs Any-Allow
- **Conditional decisions** — `HAS_ANNOTATION`, `IS_ENTITY_OWNER` built-in
- **Import/Export policies** ca YAML
- **Default + Fallback policies** configurabile via app-config
- **Policy Tester** — testare live a politicilor
- **Plugin registration** — `permissionsRegistry.addPermissions()`

**CE NE LIPSEȘTE:**

- Policy lifecycle (draft/published/inactive)
- Resolution strategies
- Conditional rules (HAS_ANNOTATION, IS_ENTITY_OWNER)
- Policy import/export
- Policy tester
- Plugin permissions registration

---

### 6. ENTITY OVERLAYS — Close, dar lipsesc detalii

**Ce are Portal-ul:**

- **5 metadata types**: Labels, Annotations, Tags, Owner, Lifecycle
- **3 permission rules**: Admin unrestricted, Owner own entities, Any user unowned entities
- **Ellipsis menu (⋯)** — "Edit entity overlay" option
- **Confirmation dialog** pe save
- **Background processing** — up to 2 minute delay

**CE NE LIPSEȘTE:**

- Tags și Lifecycle overlays (avem doar annotations + labels)
- Ellipsis menu integration
- Background processing with delay indicator

---

### 7. CONFIDENCE FLAGS — Echivalent GrowthBook, dar MULT mai bogat

**Ce are Portal-ul:**

- **SDKs native** pentru 11 platforme: iOS, Android, Java, Go, JS (Web+Node), Python, Flutter, Rust, PHP, Ruby
- **Targeting rules** sofisticate (B2B, B2C)
- **Incremental rollouts** — "10% of users"
- **Resolve tester** — testare live a flag resolution
- **Audiences** — segmentare avansată

**CE NE LIPSEȘTE:**

- GrowthBook e un proxy simplu, nu are: targeting rules, audiences, rollout percentages, resolve tester, native SDKs
- GrowthBook e o decizie arhitecturală diferită (proxy extern vs built-in)

---

### 8. HOME — Mai puțin diferit

**Ce are Portal-ul:**

- **Built-in widgets**: My Open PRs, Assigned PRs, My Bookmarks, Top/Recently Visited, Shortcuts, Team Software Catalog
- **Admin-only customization** — org-wide, nu per-user
- **Drag-and-drop layout** — reordering + resizing
- **Shortcut widgets** — admin-curated links (max 4 widgets)

**CE AVEM:** Home Customizer — similar, dar cu reordering prin butoane, nu drag-and-drop.

---

### 9. DATA EXPERIENCE — Mai complet

**Ce are Portal-ul:**

- **5 warehouse integrations**: Redshift, Snowflake, BigQuery, Databricks, dbt
- **Data Lineage** visualization
- **dbt integration** — models ca entități, tab dedicat pe dataset page
- **Access Request flow** — submit din entity page, conversation history tracked
- **Catalog Health view** — ingestion status, validation failures, exclusion patterns
- **Soundcheck integration** — Data Registry Fact Collector
- **AI integration** — MCP tools pentru data search

**CE NE LIPSEȘTE:**

- Warehouse integrations reale (avem doar extensionPoint)
- Data lineage visualization
- dbt integration
- Access request conversation tracking
- Catalog health view

---

### 10. DEVEX METRICS — Mai sofisticat

**Ce are Portal-ul:**

- **DORA + AI Usage Metrics** pe aceeași pagină
- **Timeseries charts** + **Histogram views**
- **Date Range**: rolling (1/3/6 luni) + fixed (quarter/half-year) + ISO weeks
- **Segmentation**: per team + per Soundcheck track
- **Metric Overlays** — linie dashed de comparație (period-over-period sau cross-metric)
- **Diagnose Panel** — query scope, attribution distribution, data completeness

**CE NE LIPSEȘTE:**

- Chart implementations reale (avem sparkline inline SVG)
- AI Usage Metrics
- Metric overlays
- Diagnose panel
- ISO week alignment
- Soundcheck track segmentation

---

### 11. INSIGHTS — Incomplet documentat, dar distinct

**Ce are Portal-ul:**

- **Usage Analytics** — active user trends
- **Feature engagement** — Catalog, Templates, Search usage
- **Surveys** — contextual feedback cu configurare
- **48h warm-up** pentru dashboards inițiale

---

### 12. AUDIT LOGS — Mai structurat

**Ce are Portal-ul:**

- **Severity levels** — medium, high, etc.
- **Plugin-scoped events** — filtrat per plugin ID
- **REST API** — `GET /api/audit-log/v1/audit-event` cu paginare
- **Structured schema** — event_id, severity_level, actor, request details, action_type

**CE NE LIPSEȘTE:**

- Severity levels (avem doar succeeded/failed)
- Plugin ID scoping
- Request details capture

---

### 13. PORTAL MCP — Avem, dar e important de notat

**Ce are Portal-ul:**

- Actions Registry — plugins înregistrează capabilities
- Single MCP endpoint — Streamable HTTP
- Auth: Static tokens + CIMD (OAuth)
- Integrări: AiKA, Claude Code, Cursor, VS Code Copilot

**CE AVEM:** `plugin-mcp-actions-backend` deja wired — acesta e bun.

---

### 14. PORTAL CLI — Feature NOU, nu l-am implementat

**Ce are Portal-ul:**

- CLI tool pentru Portal workflows din terminal

---

### 15. PORTAL CONNECT — Feature NOU, nu l-am implementat

**Ce are Portal-ul:**

- Tunnel securizat între Portal cloud și servicii on-prem
- (Nu se aplică pentru self-hosted, dar conceptul de secure connectivity e relevant)

---

## SUMAR DELTA

| Feature               | Portal                                                                     | Noi                  | Gap        |
| --------------------- | -------------------------------------------------------------------------- | -------------------- | ---------- |
| Soundcheck Checks     | No-code builder, 23 operators, 4 resolvers, dry run, templates, exemptions | Basic CRUD tabele    | **MAJOR**  |
| Soundcheck Insights   | Charts, trends, aggregate stats                                            | Inexistent           | **MAJOR**  |
| Soundcheck Collectors | 14 collectors                                                              | 7 collectors         | **MEDIUM** |
| AiKA/AI Assistant     | Side panel, DOM capture, 6 procesoare, mode discovery                      | Pagină chat separată | **MAJOR**  |
| Fleetshift            | NPM/OpenRewrite shifts, real-time logs, diff preview                       | Stub execution       | **MAJOR**  |
| Catalog Builder       | Bulk wizard, 2 modes, multi-provider                                       | Inexistent           | **MAJOR**  |
| RBAC                  | Policy lifecycle, conditional rules, policy tester                         | Basic CRUD           | **MAJOR**  |
| Confidence Flags      | 11 SDKs, targeting, rollouts, tester                                       | GrowthBook proxy     | **MEDIUM** |
| Entity Overlays       | 5 metadata types, ellipsis menu                                            | 2 metadata types     | **MINOR**  |
| DevEx Metrics         | Charts, overlays, segmentation, AI metrics                                 | Sparkline stubs      | **MAJOR**  |
| Data Experience       | 5 warehouses, lineage, dbt, access requests                                | Extension point only | **MAJOR**  |
| Home                  | Drag-drop, 7 widgets, admin control                                        | Button reorder       | **MINOR**  |
| Audit Logs            | Severity, plugin scoping, structured API                                   | Basic events         | **MINOR**  |
| Portal CLI            | Terminal workflows                                                         | Inexistent           | **NEW**    |
| Skill Exchange        | YAML-configured skills, notification builders                              | Basic CRUD           | **MINOR**  |

**FEATURES COMPLET LIPSĂ:**

1. Catalog Builder (bulk ingestion wizard)
2. Portal CLI
3. Portal Connect (nu necesar self-hosted)
