/*
 * Copyright 2022 The Backstage Authors
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

import { createBackend } from '@backstage/backend-defaults';
import {
  coreServices,
  createBackendFeatureLoader,
} from '@backstage/backend-plugin-api';
import { permissionModuleRbacPolicy } from '@backstage/plugin-rbac-backend';
import { catalogModuleEntityOverlays } from '@backstage/plugin-entity-overlays-backend';

const backend = createBackend();

// An example of how to group together and load multiple features. You can also
// access root-scoped services by adding `deps`.
const searchLoader = createBackendFeatureLoader({
  deps: {
    config: coreServices.rootConfig,
  },
  *loader({ config }) {
    yield import('@backstage/plugin-search-backend');
    yield import('@backstage/plugin-search-backend-module-catalog');
    yield import('@backstage/plugin-search-backend-module-explore');
    yield import('@backstage/plugin-search-backend-module-techdocs');
    if (config.has('search.elasticsearch')) {
      yield import('@backstage/plugin-search-backend-module-elasticsearch');
    }
  },
});

backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-auth-backend-module-gitlab-provider'));
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-catalog-backend-module-unprocessed'));
backend.add(import('@backstage/plugin-catalog-backend-module-ai-model'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(import('@backstage/plugin-catalog-backend-module-azure'));
backend.add(import('@backstage/plugin-catalog-backend-module-gitlab'));
backend.add(import('@backstage/plugin-catalog-backend-module-gitlab-org'));
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));
backend.add(import('@backstage/plugin-events-backend'));
backend.add(import('@backstage/plugin-devtools-backend'));
backend.add(import('@backstage/plugin-kubernetes-backend'));
// Governance — RBAC replaces allow-all policy
backend.add(import('@backstage/plugin-rbac-backend'));
backend.add(permissionModuleRbacPolicy);
backend.add(import('@backstage/plugin-permission-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-azure'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-gitlab'));
backend.add(
  import('@backstage/plugin-scaffolder-backend-module-notifications'),
);
backend.add(
  import('@backstage/plugin-catalog-backend-module-backstage-openapi'),
);
backend.add(searchLoader);
backend.add(import('@backstage/plugin-techdocs-backend'));
backend.add(import('@backstage/plugin-signals-backend'));
backend.add(import('@backstage/plugin-notifications-backend'));

// Governance — Entity Overlays
backend.add(import('@backstage/plugin-entity-overlays-backend'));
backend.add(catalogModuleEntityOverlays);
// Governance — Audit Log
backend.add(import('@backstage/plugin-audit-log-backend'));

// Soundcheck — quality and compliance engine
backend.add(import('@backstage/plugin-soundcheck-backend'));
backend.add(import('@backstage/plugin-soundcheck-backend-module-gitlab'));
backend.add(import('@backstage/plugin-soundcheck-backend-module-kubernetes'));
backend.add(import('@backstage/plugin-soundcheck-backend-module-sonarqube'));
backend.add(import('@backstage/plugin-soundcheck-backend-module-azure-devops'));
backend.add(import('@backstage/plugin-soundcheck-backend-module-http'));
backend.add(import('@backstage/plugin-soundcheck-backend-module-jira'));
backend.add(import('@backstage/plugin-soundcheck-backend-module-scm'));

// AI Platform — Gateway, Assistant, Explorer
backend.add(import('@backstage/plugin-ai-gateway-backend'));
backend.add(import('@backstage/plugin-ai-gateway-backend-module-anthropic'));
backend.add(import('@backstage/plugin-ai-gateway-backend-module-openai'));
backend.add(import('@backstage/plugin-ai-gateway-backend-module-ollama'));
backend.add(import('@backstage/plugin-ai-gateway-backend-module-bedrock'));
backend.add(import('@backstage/plugin-ai-assistant-backend'));
backend.add(import('@backstage/plugin-ai-explorer-backend'));

// Intelligence — DevEx Metrics, Insights, Fleetshift
backend.add(import('@backstage/plugin-devex-metrics-backend'));
backend.add(import('@backstage/plugin-devex-metrics-backend-module-gitlab'));
backend.add(
  import('@backstage/plugin-devex-metrics-backend-module-azure-devops'),
);
backend.add(import('@backstage/plugin-insights-backend'));
backend.add(import('@backstage/plugin-fleetshift-backend'));
backend.add(import('@backstage/plugin-fleetshift-backend-module-gitlab'));
backend.add(import('@backstage/plugin-fleetshift-backend-module-azure-devops'));

// Ecosystem — Data Experience, GrowthBook, Skill Exchange
backend.add(import('@backstage/plugin-data-experience-backend'));
backend.add(
  import('@backstage/plugin-data-experience-backend-module-snowflake'),
);
backend.add(
  import('@backstage/plugin-data-experience-backend-module-bigquery'),
);
backend.add(import('@backstage/plugin-data-experience-backend-module-dbt'));
backend.add(import('@backstage/plugin-growthbook-backend'));
backend.add(import('@backstage/plugin-skill-exchange-backend'));

backend.add(import('@backstage/plugin-catalog-builder-backend'));

backend.add(import('@backstage/plugin-events-backend-module-gitlab'));
backend.add(import('@backstage/plugin-mcp-actions-backend'));
backend.add(import('@backstage/plugin-user-settings-backend'));
backend.start();
