# Sub-project 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure Backstage OSS for Yoda.Digital's stack — GitLab self-hosted auth, GitLab org-wide catalog discovery, Azure DevOps integration, Kubernetes, PostgreSQL database, production-grade Search and TechDocs.

**Architecture:** Replace the dev-oriented defaults (SQLite in-memory, GitHub auth, guest auth, local TechDocs) with production configuration targeting git.yoda.digital (GitLab), Azure DevOps, and Kubernetes clusters. No new packages are created — this is wiring and configuration of existing backend modules and frontend plugins.

**Tech Stack:** PostgreSQL, GitLab OAuth, GitLab Discovery Entity Provider, Azure DevOps plugins, Kubernetes plugin (already wired), MkDocs with external storage for TechDocs.

**Spec:** `docs/superpowers/specs/2026-09-11-yoda-portal-architecture-design.md` — Sub-project 1 section.

## Global Constraints

- Backstage new frontend system only — no old system patterns
- All config values via environment variables (`${VAR}`) — no hardcoded secrets
- Follow existing `app-config.yaml` structure conventions
- Copyright headers on all new `.ts` files (Apache 2.0, year 2026)
- GitLab self-hosted at `git.yoda.digital`
- Backend default auth policy must be enabled (remove `dangerouslyDisableDefaultAuthPolicy`)

---

### Task 1: Create Yoda.Digital App Config

**Files:**

- Create: `app-config.yoda.yaml`

**Interfaces:**

- Consumes: nothing
- Produces: Yoda.Digital-specific app config overlay, loaded via `--config app-config.yoda.yaml`

- [ ] **Step 1: Create `app-config.yoda.yaml` with core settings**

```yaml
app:
  title: Yoda.Digital Developer Portal
  baseUrl: ${PORTAL_BASE_URL}

organization:
  name: Yoda.Digital

backend:
  baseUrl: ${BACKEND_BASE_URL}
  listen:
    port: 7007
  database:
    client: pg
    connection:
      host: ${POSTGRES_HOST}
      port: ${POSTGRES_PORT}
      user: ${POSTGRES_USER}
      password: ${POSTGRES_PASSWORD}
  auth:
    dangerouslyDisableDefaultAuthPolicy: false
  cors:
    origin: ${PORTAL_BASE_URL}
    methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
    credentials: true

integrations:
  gitlab:
    - host: git.yoda.digital
      apiBaseUrl: https://git.yoda.digital/api/v4
      token: ${GITLAB_TOKEN}
  azure:
    - host: dev.azure.com
      token: ${AZURE_TOKEN}

auth:
  environment: production
  providers:
    gitlab:
      production:
        clientId: ${AUTH_GITLAB_CLIENT_ID}
        clientSecret: ${AUTH_GITLAB_CLIENT_SECRET}
        audience: https://git.yoda.digital
        callbackUrl: ${BACKEND_BASE_URL}/api/auth/gitlab/handler/frame
        signIn:
          resolvers:
            - resolver: usernameMatchingUserEntityName

catalog:
  import:
    entityFilename: catalog-info.yaml
    pullRequestBranchName: backstage-integration
  rules:
    - allow:
        - Component
        - API
        - Resource
        - System
        - Domain
        - Location
        - Template
        - Group
        - User
  providers:
    gitlab:
      yoda:
        host: git.yoda.digital
        branch: main
        fallbackBranch: master
        skipForkedRepos: false
        schedule:
          frequency: { minutes: 10 }
          timeout: { minutes: 3 }
    gitlabOrg:
      yoda:
        host: git.yoda.digital
        schedule:
          frequency: { minutes: 30 }
          timeout: { minutes: 3 }

techdocs:
  builder: external
  publisher:
    type: local

search:
  pg: {}

permission:
  enabled: true

kubernetes:
  clusterLocatorMethods:
    - type: config
      clusters:
        - name: ${K8S_CLUSTER_NAME}
          url: ${K8S_CLUSTER_URL}
          authProvider: serviceAccount
          serviceAccountToken: ${K8S_SERVICE_ACCOUNT_TOKEN}
          skipTLSVerify: false
          skipMetricsLookup: false
```

- [ ] **Step 2: Verify config loads without errors**

Run: `node -e "const yaml = require('js-yaml'); const fs = require('fs'); yaml.load(fs.readFileSync('app-config.yoda.yaml', 'utf8')); console.log('Valid YAML')"`
Expected: `Valid YAML`

- [ ] **Step 3: Commit**

```bash
git add app-config.yoda.yaml
git commit -s -m "feat: add Yoda.Digital environment app config

PostgreSQL database, GitLab self-hosted auth and catalog discovery,
Azure DevOps integration, Kubernetes cluster config, production
TechDocs and Search settings."
```

---

### Task 2: Wire GitLab Auth Backend Module

**Files:**

- Create: `packages/backend/src/authModuleGitlabProvider.ts`
- Modify: `packages/backend/src/index.ts`

**Interfaces:**

- Consumes: `@backstage/plugin-auth-backend-module-gitlab-provider`, `coreServices`
- Produces: GitLab OAuth sign-in resolver mapped to Backstage user entities

- [ ] **Step 1: Write the GitLab auth module with sign-in resolver**

Create `packages/backend/src/authModuleGitlabProvider.ts`:

```ts
/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createBackendModule } from '@backstage/backend-plugin-api';
import {
  gitlabAuthenticator,
  gitlabSignInResolvers,
} from '@backstage/plugin-auth-backend-module-gitlab-provider';
import { authProvidersExtensionPoint } from '@backstage/plugin-auth-node';

export default createBackendModule({
  pluginId: 'auth',
  moduleId: 'gitlab-provider',
  register(reg) {
    reg.registerInit({
      deps: {
        providers: authProvidersExtensionPoint,
      },
      async init({ providers }) {
        providers.registerProvider({
          providerId: 'gitlab',
          factory: {
            authenticator: gitlabAuthenticator,
            signInResolverFactories: {
              ...gitlabSignInResolvers,
            },
          },
        });
      },
    });
  },
});
```

- [ ] **Step 2: Update backend index to wire GitLab modules**

Modify `packages/backend/src/index.ts` — add GitLab auth, catalog discovery, org discovery, events, and scaffolder modules. Remove GitHub-specific auth. Add Azure DevOps modules.

After the existing `backend.add(import('@backstage/plugin-auth-backend'));` line, replace the GitHub auth line and add:

```ts
// Auth — GitLab (primary for Yoda.Digital)
backend.add(import('./authModuleGitlabProvider'));
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));

// Catalog — GitLab discovery (repos + org)
backend.add(import('@backstage/plugin-catalog-backend-module-gitlab'));
backend.add(import('@backstage/plugin-catalog-backend-module-gitlab-org'));

// Events — GitLab webhooks for real-time catalog updates
backend.add(import('@backstage/plugin-events-backend-module-gitlab'));

// Scaffolder — GitLab actions (create repo, create MR, etc.)
backend.add(import('@backstage/plugin-scaffolder-backend-module-gitlab'));

// Azure DevOps — catalog + scaffolder
backend.add(import('@backstage/plugin-catalog-backend-module-azure'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-azure'));
```

Remove these lines:

```ts
// REMOVE: backend.add(import('./authModuleGithubProvider'));
// REMOVE: backend.add(import('@backstage/plugin-auth-backend-module-openshift-provider'));
// REMOVE: backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
// REMOVE: backend.add(import('@backstage/plugin-events-backend-module-google-pubsub'));
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `yarn tsc 2>&1 | head -20`
Expected: No errors related to the auth module or imports

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/authModuleGitlabProvider.ts packages/backend/src/index.ts
git commit -s -m "feat: wire GitLab auth, catalog discovery, and Azure DevOps backends

Replace GitHub auth with GitLab OAuth for git.yoda.digital.
Add GitLab org and repo discovery for automated catalog population.
Add GitLab events module for webhook-driven updates.
Add Azure DevOps catalog and scaffolder modules."
```

---

### Task 3: Configure Frontend for Yoda.Digital Stack

**Files:**

- Modify: `packages/app/src/App.tsx`
- Modify: `packages/app/src/modules/appModuleNav.tsx` (if exists, to update sidebar)

**Interfaces:**

- Consumes: `@backstage/plugin-catalog/alpha`, existing frontend plugins
- Produces: Frontend app configured with correct plugin set

- [ ] **Step 1: Examine current appModuleNav for sidebar customization**

Run: `cat packages/app/src/modules/appModuleNav.tsx`

This determines how the sidebar is structured. Note the nav items for later sub-projects (Soundcheck, AI Assistant, etc. will add sidebar items here).

- [ ] **Step 2: Update App.tsx — add scaffolder plugin from new frontend system**

In `packages/app/src/App.tsx`, check if scaffolder is loaded via the new frontend system. Currently it's loaded as a module (`appModuleScaffolder`). Ensure it's properly wired.

The frontend is already well-configured with:

- `catalogPlugin` (new frontend system with overrides)
- `kubernetesPlugin` (new frontend system)
- `homePlugin`, `userSettingsPlugin`, `appVisualizerPlugin`
- TechDocs via legacy compat

No major changes needed for Foundation — the frontend plugins (catalog, K8s, TechDocs, search, scaffolder) are already wired. Specific frontend additions come in later sub-projects.

- [ ] **Step 3: Commit (if changes were made)**

```bash
git add packages/app/src/
git commit -s -m "feat: configure frontend for Yoda.Digital stack"
```

---

### Task 4: Verify Full Stack Integration

**Files:**

- No new files — integration verification

**Interfaces:**

- Consumes: All configuration from Tasks 1-3
- Produces: Verified working Backstage instance

- [ ] **Step 1: Type check the entire project**

Run: `yarn tsc 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 2: Run backend tests for modified plugins**

Run: `CI=1 yarn test packages/backend 2>&1 | tail -20`
Expected: Tests pass

- [ ] **Step 3: Run auth module tests**

Run: `CI=1 yarn test plugins/auth-backend-module-gitlab-provider 2>&1 | tail -20`
Expected: Tests pass

- [ ] **Step 4: Run GitLab catalog module tests**

Run: `CI=1 yarn test plugins/catalog-backend-module-gitlab 2>&1 | tail -20`
Expected: Tests pass

- [ ] **Step 5: Run Azure DevOps catalog module tests**

Run: `CI=1 yarn test plugins/catalog-backend-module-azure 2>&1 | tail -20`
Expected: Tests pass

- [ ] **Step 6: Verify dev server starts (without Yoda.Digital credentials)**

Run: `yarn start 2>&1 | head -30` (starts with default `app-config.yaml`, not yoda overlay)
Expected: Backend starts on :7007, frontend on :3000, no import errors

- [ ] **Step 7: Commit verification notes**

No commit needed — this is verification only. Proceed to Sub-project 2.

---

## Post-Foundation: What's Ready for Sub-project 2

After Foundation completes, the following is in place:

| Component                 | Status                                                      |
| ------------------------- | ----------------------------------------------------------- |
| GitLab OAuth auth         | ✅ Wired with sign-in resolver                              |
| GitLab catalog discovery  | ✅ Org-wide repo scanning every 10 min                      |
| GitLab org discovery      | ✅ Users and groups every 30 min                            |
| GitLab events (webhooks)  | ✅ Real-time catalog updates                                |
| GitLab scaffolder actions | ✅ Create repo, create MR, etc.                             |
| Azure DevOps catalog      | ✅ Pipeline and repo discovery                              |
| Azure DevOps scaffolder   | ✅ Template actions for ADO                                 |
| Kubernetes                | ✅ Already wired                                            |
| PostgreSQL                | ✅ Via app-config.yoda.yaml                                 |
| Search (PostgreSQL)       | ✅ Via `search.pg` config                                   |
| TechDocs                  | ✅ External builder configured                              |
| MCP Actions Backend       | ✅ Already wired                                            |
| Events + Signals          | ✅ Already wired                                            |
| Notifications             | ✅ Already wired                                            |
| Permissions               | ✅ Enabled, currently allow-all (replaced in Sub-project 2) |

**Next:** Sub-project 2: Governance (RBAC UI, Entity Overlays, Audit Logs)
