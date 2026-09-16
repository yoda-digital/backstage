# Yoda.Digital Developer Portal

Backstage OSS extended with ~75 plugins that replicate the commercial features from Spotify's Portal for Backstage. Self-hosted, integrated with GitLab, Kubernetes, JHelp, and Azure DevOps instead of GitHub.

## Why

Spotify sells Portal as a managed service on top of Backstage. It adds Soundcheck, RBAC, an AI assistant, fleet-wide code transformations, DORA metrics, and about a dozen other features that the open-source project does not include.

We wanted those features on our own infrastructure, wired into GitLab and Azure DevOps.

## What's in here

### Governance

RBAC with a policy lifecycle (draft, published, inactive), two resolution strategies (first-match and any-allow), five conditional rules (IS_ENTITY_OWNER, HAS_ANNOTATION, HAS_TAG, HAS_LABEL, IN_SYSTEM), a policy tester, and YAML import/export. Entity Overlays for user-managed metadata (annotations, labels, tags, lifecycle, owner) merged at catalog read time. An audit log capturing every mutation with severity levels, plugin scoping, and a filterable viewer.

### Quality and compliance

Soundcheck: 30 operators, four path resolvers (JSONPath, Lodash, JMESPath, JSONata), a no-code check builder, Liquid message templating, exemptions, 14 fact collectors (GitLab, K8s, SonarQube, Azure DevOps, HTTP, Jira, SCM, JHelp, BigQuery, Datadog, New Relic, PagerDuty, Snyk, Catalog), insights dashboards with SVG charts, a bronze/silver/gold badge system, check templates, and YAML/CSV import/export.

### AI

An AI Gateway that proxies Anthropic, OpenAI, Ollama, and AWS Bedrock with model routing and usage tracking. AiKA, an AI assistant that lives in a side panel (draggable FAB, 420px overlay on every page) with six processors (classification, planning, formatting, verification, confidence scoring, context management), a mode system, DOM context capture, and plugin-aware suggestions. An AI Explorer for managing rules, skills, and plugins.

### Intelligence

DevEx Metrics with a DORA dashboard (timeseries, histogram, and donut SVG charts), date range controls, team and track segmentation, metric overlays, a diagnose panel, and AI usage tracking. Insights for portal adoption analytics and developer feedback surveys. Fleetshift for fleet-wide code transformations across GitLab and Azure DevOps, supporting AI agent shifts, NPM package upgrades, and OpenRewrite recipes, with real-time execution logs and diff preview. A visual template editor with form designer, action configurator, and dry run.

### Ecosystem

Data Experience: a dataset catalog with Snowflake, BigQuery, and dbt warehouse connectors, data lineage visualization, and an access request workflow. GrowthBook integration for feature flag management. Skill Exchange: an internal gig marketplace (mentor, pair, hack, embed) with matching and notifications. A homepage customizer with drag-and-drop widget layout. Catalog Builder: a bulk ingestion wizard for GitLab and Azure DevOps repositories in Portal-managed or YAML-managed mode.

## Stack

| Component      | Technology                                                   |
| -------------- | ------------------------------------------------------------ |
| Source control | GitLab self-hosted (git.yoda.digital)                        |
| CI/CD          | GitLab CI + Azure DevOps Pipelines                           |
| Infrastructure | Kubernetes                                                   |
| Helpdesk       | JHelp                                                        |
| Database       | PostgreSQL                                                   |
| Auth           | GitLab OAuth (primary), Azure AD (secondary)                 |
| AI providers   | Anthropic Claude, OpenAI, Ollama, AWS Bedrock via AI Gateway |

## Getting started

```bash
yarn install
yarn start  # frontend on :3000, backend on :7007
```

For the Yoda.Digital environment:

```bash
yarn start --config app-config.yaml --config app-config.yoda.yaml
```

Required environment variables are documented in `app-config.yoda.yaml`.

## Architecture

Six sub-projects, following Backstage plugin conventions (ADR011):

1. Foundation: GitLab, Azure, and K8s wiring (configuration only, no new packages)
2. Governance: RBAC, Entity Overlays, Audit Log
3. Soundcheck: quality engine with 14 fact collectors
4. AI Platform: Gateway, Assistant (AiKA), Explorer
5. Intelligence: DevEx Metrics, Insights, Fleetshift, Template Editor
6. Ecosystem: Data Experience, GrowthBook, Skill Exchange, Home Customizer, Catalog Builder

Design specs are in `docs/superpowers/specs/`. Implementation plans are in `docs/superpowers/plans/`.

## Standards

Every custom plugin in this repo:

- Emits audit events on state mutations
- Checks RBAC permissions on write endpoints
- Externalizes UI strings through i18n translation refs
- Has backend and frontend tests
- Passes `yarn tsc` with no errors
- Declares config fields in `config.d.ts` with `@visibility` annotations
- Uses the new frontend system (Blueprints, no legacy patterns)

## License

Apache 2.0, same as upstream Backstage.
