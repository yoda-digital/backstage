# Yoda.Digital Developer Portal

72 Backstage plugins that replicate Spotify's Portal for Backstage. Self-hosted, wired to GitLab, Kubernetes, JHelp, and Azure DevOps.

This is a standalone Backstage app created with `@backstage/create-app`. All `@backstage/*` packages come from npm. To upgrade Backstage, run `yarn backstage-cli versions:bump`.

## Quick start

```bash
git clone git@github.com:yoda-digital/backstage.git
cd backstage
yarn install
yarn dev
```

Frontend runs on `:3000`, backend on `:7007`.

For production config:

```bash
yarn dev --config app-config.yaml --config app-config.yoda.yaml
```

Set the environment variables listed in `app-config.yoda.yaml` before starting.

## Adding these plugins to your own Backstage

### To a fresh Backstage app

```bash
npx @backstage/create-app@latest
cd your-app
```

Copy the `plugins/` directory from this repo into yours:

```bash
cp -r /path/to/this-repo/plugins/* plugins/
```

Then register each plugin in your backend (`packages/backend/src/index.ts`) and frontend (`packages/app/src/App.tsx`). See those files in this repo for the exact import lines.

### To an existing Backstage app

Pick the plugins you want. Each one is self-contained under `plugins/<name>/`. Copy the directory, add it to your workspaces, and wire it in.

Example: adding RBAC to an existing app.

1. Copy the packages:

```bash
cp -r plugins/rbac-common plugins/rbac-node plugins/rbac-backend plugins/rbac your-app/plugins/
```

2. Run `yarn install` so Yarn picks up the new workspaces.

3. Add the backend plugin to `packages/backend/src/index.ts`:

```ts
import { permissionModuleRbacPolicy } from '@backstage/plugin-rbac-backend';

// Replace the allow-all policy with RBAC
backend.add(import('@backstage/plugin-rbac-backend'));
backend.add(permissionModuleRbacPolicy);
```

4. Add the frontend plugin to `packages/app/src/App.tsx`:

```ts
import rbacPlugin from '@backstage/plugin-rbac';

// In the features array:
rbacPlugin,
```

5. Add dependencies to your `packages/backend/package.json` and `packages/app/package.json`:

```json
"@backstage/plugin-rbac-backend": "workspace:^",
"@backstage/plugin-rbac": "workspace:^"
```

Every plugin follows this same pattern. The table below lists what to copy and where to wire it.

## Plugin inventory

### Governance

| Plugin | Backend | Frontend | Common | Node |
|--------|---------|----------|--------|------|
| RBAC | `rbac-backend` | `rbac` | `rbac-common` | `rbac-node` |
| Entity Overlays | `entity-overlays-backend` | `entity-overlays` | `entity-overlays-common` | |
| Audit Log | `audit-log-backend` | `audit-log` | `audit-log-common` | |

### Soundcheck

| Plugin | Backend | Modules |
|--------|---------|---------|
| Soundcheck | `soundcheck-backend` | `soundcheck-backend-module-gitlab`, `-kubernetes`, `-sonarqube`, `-azure-devops`, `-http`, `-jira`, `-scm`, `-jhelp`, `-bigquery`, `-datadog`, `-newrelic`, `-pagerduty`, `-snyk`, `-catalog` |
| | | Common: `soundcheck-common`, Node: `soundcheck-node`, Frontend: `soundcheck` |

### AI platform

| Plugin | Backend | Frontend | Common | Node |
|--------|---------|----------|--------|------|
| AI Gateway | `ai-gateway-backend` | `ai-gateway` | `ai-gateway-common` | `ai-gateway-node` |
| AI Assistant (AiKA) | `ai-assistant-backend` | `ai-assistant` | `ai-assistant-common` | `ai-assistant-node` |
| AI Explorer | `ai-explorer-backend` | `ai-explorer` | `ai-explorer-common` | |

Provider modules: `ai-gateway-backend-module-anthropic`, `-openai`, `-ollama`, `-bedrock`

### Intelligence

| Plugin | Backend | Frontend | Common | Node |
|--------|---------|----------|--------|------|
| DevEx Metrics | `devex-metrics-backend` | `devex-metrics` | `devex-metrics-common` | |
| Insights | `insights-backend` | `insights` | | |
| Fleetshift | `fleetshift-backend` | `fleetshift` | `fleetshift-common` | `fleetshift-node` |
| Template Editor | | `template-editor` | | |

Collector modules: `devex-metrics-backend-module-gitlab`, `-azure-devops`
Provider modules: `fleetshift-backend-module-gitlab`, `-azure-devops`

### Ecosystem

| Plugin | Backend | Frontend | Common | Node |
|--------|---------|----------|--------|------|
| Data Experience | `data-experience-backend` | `data-experience` | `data-experience-common` | `data-experience-node` |
| GrowthBook | `growthbook-backend` | `growthbook` | | |
| Skill Exchange | `skill-exchange-backend` | `skill-exchange` | `skill-exchange-common` | |
| Home Customizer | | `home-customizer` | | |
| Catalog Builder | `catalog-builder-backend` | `catalog-builder` | | |

Warehouse modules: `data-experience-backend-module-snowflake`, `-bigquery`, `-dbt`

## Stack

| Component | Technology |
|-----------|-----------|
| Source control | GitLab self-hosted (git.yoda.digital) |
| CI/CD | GitLab CI + Azure DevOps Pipelines |
| Infrastructure | Kubernetes |
| Helpdesk | JHelp |
| Database | PostgreSQL |
| Auth | GitLab OAuth (primary), Azure AD (secondary) |
| AI providers | Anthropic, OpenAI, Ollama, AWS Bedrock via AI Gateway |

## Architecture

Six groups of plugins, each with backend, frontend, common types, and node extension points where needed:

1. Governance (RBAC, Overlays, Audit) has no dependencies on other groups
2. Soundcheck (checks, tracks, campaigns, collectors) depends on Governance for permissions
3. AI Platform (Gateway, Assistant, Explorer) depends on Governance for permissions
4. Intelligence (Metrics, Insights, Fleetshift, Templates) depends on AI Gateway for LLM calls
5. Ecosystem (Data, GrowthBook, Skills, Home, Catalog Builder) depends on Governance
6. Foundation is config only (`app-config.yoda.yaml`)

Design specs: `docs/superpowers/specs/`
Implementation plans: `docs/superpowers/plans/`

## Standards

Every plugin in this repo:

- Emits audit events on mutations
- Checks RBAC permissions on writes
- Externalizes UI strings through i18n
- Has backend and frontend tests
- Passes `yarn tsc` with no errors

## License

Apache 2.0.
