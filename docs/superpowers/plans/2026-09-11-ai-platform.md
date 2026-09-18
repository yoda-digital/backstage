# Sub-project 4: AI Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-provider AI gateway, conversational AI assistant with RAG, and an AI explorer for managing rules/skills/plugins — all as Backstage plugins using the new frontend system.

**Architecture:** Three plugin families (Gateway, Assistant, Explorer) layered bottom-up. The AI Gateway provides a normalized LLM proxy with provider modules. The AI Assistant uses the Gateway for inference and MCP Actions Backend (already in repo) for tool use, with a RAG pipeline pulling context from TechDocs, Catalog, and other knowledge sources. The AI Explorer manages guardrail rules, reusable prompt skills, and MCP plugin registrations.

**Tech Stack:** TypeScript, PostgreSQL (Knex migrations), Backstage backend-plugin-api / frontend-plugin-api, Anthropic SDK, OpenAI SDK, streaming via AsyncIterable, React (new frontend system with Blueprints).

**Spec:** `docs/superpowers/specs/2026-09-11-devpane-portal-architecture-design.md` — Sub-project 4 section.

## Global Constraints

- New frontend system only — `createFrontendPlugin` from `@backstage/frontend-plugin-api`
- All backend plugins via `createBackendPlugin` from `@backstage/backend-plugin-api`
- All modules via `createBackendModule`
- Extension points via `createExtensionPoint`
- Copyright headers: Apache 2.0, year 2026
- No `React.FC`, no default exports (except `React.lazy`), `function` keyword for exported functions
- ADR011 naming: all `@backstage/plugin-ai-*`
- ADR004 exports: `index.ts` → named re-exports only
- Config values via `${ENV_VAR}` — API keys marked `@visibility secret`
- Every write operation behind a permission check
- Every state mutation emits an audit event
- TDD: write failing test first, implement, verify

---

### Task 1: AI Gateway Common Package

**Files:**

- Create: `plugins/ai-gateway-common/package.json`
- Create: `plugins/ai-gateway-common/src/index.ts`
- Create: `plugins/ai-gateway-common/src/types.ts`
- Create: `plugins/ai-gateway-common/src/models.ts`
- Create: `plugins/ai-gateway-common/src/permissions.ts`

**Interfaces:**

- Consumes: `@backstage/plugin-permission-common`
- Produces: `AiChatRequest`, `AiChatChunk`, `AiChatResponse`, `AiModel`, `AiProviderCapabilities`, `AiProviderInfo`, `AiUsageRecord`, permission definitions

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@backstage/plugin-ai-gateway-common",
  "version": "0.1.0",
  "backstage": {
    "role": "common-library",
    "pluginId": "ai-gateway",
    "pluginPackages": [
      "@backstage/plugin-ai-gateway",
      "@backstage/plugin-ai-gateway-backend",
      "@backstage/plugin-ai-gateway-common",
      "@backstage/plugin-ai-gateway-node"
    ]
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@backstage/plugin-permission-common": "workspace:^"
  }
}
```

- [ ] **Step 2: Create types.ts with core domain types**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

/** A request to a chat-capable AI model. */
export interface AiChatRequest {
  /** Target model id, e.g. "claude-sonnet-4-20250514" */
  modelId: string;
  /** Conversation messages */
  messages: AiChatMessage[];
  /** Optional system prompt */
  system?: string;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Temperature 0-1 */
  temperature?: number;
  /** Whether to stream the response */
  stream?: boolean;
}

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** A single chunk in a streaming chat response */
export interface AiChatChunk {
  /** The text delta */
  delta: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Usage info, present only on the final chunk */
  usage?: AiTokenUsage;
}

/** Non-streaming chat response */
export interface AiChatResponse {
  content: string;
  modelId: string;
  usage: AiTokenUsage;
}

export interface AiTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiModel {
  id: string;
  providerId: string;
  name: string;
  capabilities: AiModelCapabilities;
}

export interface AiModelCapabilities {
  chat: boolean;
  streaming: boolean;
  vision: boolean;
  toolUse: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
}

export interface AiProviderCapabilities {
  providerId: string;
  displayName: string;
  supportedModels: AiModel[];
}

export interface AiProviderInfo {
  providerId: string;
  displayName: string;
  status: 'connected' | 'disconnected' | 'error';
  modelCount: number;
}

export interface AiUsageRecord {
  id: string;
  providerId: string;
  modelId: string;
  userEntityRef: string;
  promptTokens: number;
  completionTokens: number;
  timestamp: string;
}

export interface AiUsageQuery {
  providerId?: string;
  modelId?: string;
  userEntityRef?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AiUsageSummary {
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  byProvider: Record<
    string,
    { requests: number; promptTokens: number; completionTokens: number }
  >;
  byModel: Record<
    string,
    { requests: number; promptTokens: number; completionTokens: number }
  >;
}
```

- [ ] **Step 3: Create models.ts with model registry constants**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { AiModelCapabilities } from './types';

/** Well-known model capability presets */
export const MODEL_CAPABILITY_PRESETS: Record<string, AiModelCapabilities> = {
  'claude-sonnet-4-20250514': {
    chat: true,
    streaming: true,
    vision: true,
    toolUse: true,
    maxContextTokens: 200000,
    maxOutputTokens: 64000,
  },
  'gpt-4o': {
    chat: true,
    streaming: true,
    vision: true,
    toolUse: true,
    maxContextTokens: 128000,
    maxOutputTokens: 16384,
  },
};
```

- [ ] **Step 4: Create permissions.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { createPermission } from '@backstage/plugin-permission-common';

export const AI_GATEWAY_RESOURCE_TYPE = 'ai-gateway-provider';

export const aiGatewayAdminPermission = createPermission({
  name: 'ai.gateway.admin',
  attributes: { action: 'update' },
  resourceType: AI_GATEWAY_RESOURCE_TYPE,
});

export const aiGatewayChatPermission = createPermission({
  name: 'ai.gateway.chat',
  attributes: { action: 'create' },
});

export const aiGatewayUsageReadPermission = createPermission({
  name: 'ai.gateway.usage.read',
  attributes: { action: 'read' },
});

export const aiGatewayPermissions = [
  aiGatewayAdminPermission,
  aiGatewayChatPermission,
  aiGatewayUsageReadPermission,
];
```

- [ ] **Step 5: Create index.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

export {
  type AiChatRequest,
  type AiChatMessage,
  type AiChatChunk,
  type AiChatResponse,
  type AiTokenUsage,
  type AiModel,
  type AiModelCapabilities,
  type AiProviderCapabilities,
  type AiProviderInfo,
  type AiUsageRecord,
  type AiUsageQuery,
  type AiUsageSummary,
} from './types';
export { MODEL_CAPABILITY_PRESETS } from './models';
export {
  AI_GATEWAY_RESOURCE_TYPE,
  aiGatewayAdminPermission,
  aiGatewayChatPermission,
  aiGatewayUsageReadPermission,
  aiGatewayPermissions,
} from './permissions';
```

- [ ] **Step 6: Commit**

```bash
git add plugins/ai-gateway-common/
git commit -s -m "feat(ai-gateway): add common package with types, models, and permissions"
```

---

### Task 2: AI Gateway Node Package (Extension Point)

**Files:**

- Create: `plugins/ai-gateway-node/package.json`
- Create: `plugins/ai-gateway-node/src/index.ts`
- Create: `plugins/ai-gateway-node/src/extensions.ts`
- Create: `plugins/ai-gateway-node/src/types.ts`

**Interfaces:**

- Consumes: `@backstage/plugin-ai-gateway-common` (types)
- Produces: `aiProviderExtensionPoint`, `AiProvider` interface for modules to implement

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@backstage/plugin-ai-gateway-node",
  "version": "0.1.0",
  "backstage": {
    "role": "node-library",
    "pluginId": "ai-gateway",
    "pluginPackages": [
      "@backstage/plugin-ai-gateway",
      "@backstage/plugin-ai-gateway-backend",
      "@backstage/plugin-ai-gateway-common",
      "@backstage/plugin-ai-gateway-node"
    ]
  },
  "publishConfig": {
    "access": "public",
    "main": "dist/index.cjs.js",
    "types": "dist/index.d.ts"
  },
  "license": "Apache-2.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@backstage/backend-plugin-api": "workspace:^",
    "@backstage/plugin-ai-gateway-common": "workspace:^"
  }
}
```

- [ ] **Step 2: Create types.ts with AiProvider interface**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import {
  AiChatRequest,
  AiChatChunk,
  AiChatResponse,
  AiModel,
  AiProviderCapabilities,
} from '@backstage/plugin-ai-gateway-common';

/** Interface that provider modules must implement */
export interface AiProvider {
  /** Unique provider identifier, e.g. 'anthropic', 'openai' */
  readonly providerId: string;

  /** Send a chat request and get a non-streaming response */
  chat(request: AiChatRequest): Promise<AiChatResponse>;

  /** Send a chat request and stream response chunks */
  chatStream(request: AiChatRequest): AsyncIterable<AiChatChunk>;

  /** List models available from this provider */
  listModels(): Promise<AiModel[]>;

  /** Get provider capability metadata */
  getCapabilities(): AiProviderCapabilities;
}
```

- [ ] **Step 3: Create extensions.ts with extension point**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { createExtensionPoint } from '@backstage/backend-plugin-api';
import { AiProvider } from './types';

/** Extension point where AI provider modules register themselves */
export const aiProviderExtensionPoint =
  createExtensionPoint<AiProviderExtensionPoint>({
    id: 'ai-gateway.providers',
  });

export interface AiProviderExtensionPoint {
  registerProvider(provider: AiProvider): void;
}
```

- [ ] **Step 4: Create index.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

export { type AiProvider } from './types';
export {
  aiProviderExtensionPoint,
  type AiProviderExtensionPoint,
} from './extensions';
```

- [ ] **Step 5: Commit**

```bash
git add plugins/ai-gateway-node/
git commit -s -m "feat(ai-gateway): add node package with provider extension point"
```

---

### Task 3: AI Gateway Backend

**Files:**

- Create: `plugins/ai-gateway-backend/package.json`
- Create: `plugins/ai-gateway-backend/src/index.ts`
- Create: `plugins/ai-gateway-backend/src/plugin.ts`
- Create: `plugins/ai-gateway-backend/src/service/router.ts`
- Create: `plugins/ai-gateway-backend/src/service/router.test.ts`
- Create: `plugins/ai-gateway-backend/src/service/ProviderManager.ts`
- Create: `plugins/ai-gateway-backend/src/service/UsageTracker.ts`
- Create: `plugins/ai-gateway-backend/src/database/migrations.ts`
- Create: `plugins/ai-gateway-backend/config.d.ts`

**Interfaces:**

- Consumes: `aiProviderExtensionPoint`, `coreServices.database`, `coreServices.httpRouter`, `coreServices.permissions`, `coreServices.auth`, `coreServices.httpAuth`
- Produces: REST API at `/api/ai-gateway/` — `POST /chat`, `GET /providers`, `GET /models`, `GET /usage`

- [ ] **Step 1: Create config.d.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

export interface Config {
  aiGateway?: {
    /** Default model to use when none specified */
    defaultModel?: string;
    /** Maximum tokens per request (safety limit) */
    maxTokensPerRequest?: number;
  };
}
```

- [ ] **Step 2: Create database migration**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ai_gateway_usage', table => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('provider_id').notNullable();
    table.string('model_id').notNullable();
    table.string('user_entity_ref').notNullable();
    table.integer('prompt_tokens').notNullable();
    table.integer('completion_tokens').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.index(['provider_id']);
    table.index(['user_entity_ref']);
    table.index(['created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ai_gateway_usage');
}
```

- [ ] **Step 3: Create UsageTracker**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { Knex } from 'knex';
import {
  AiUsageRecord,
  AiUsageQuery,
  AiUsageSummary,
} from '@backstage/plugin-ai-gateway-common';

export class UsageTracker {
  constructor(private readonly db: Knex) {}

  async record(params: {
    providerId: string;
    modelId: string;
    userEntityRef: string;
    promptTokens: number;
    completionTokens: number;
  }): Promise<void> {
    await this.db('ai_gateway_usage').insert({
      provider_id: params.providerId,
      model_id: params.modelId,
      user_entity_ref: params.userEntityRef,
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
    });
  }

  async query(query: AiUsageQuery): Promise<AiUsageRecord[]> {
    let qb = this.db('ai_gateway_usage').select('*');
    if (query.providerId) qb = qb.where('provider_id', query.providerId);
    if (query.modelId) qb = qb.where('model_id', query.modelId);
    if (query.userEntityRef)
      qb = qb.where('user_entity_ref', query.userEntityRef);
    if (query.from) qb = qb.where('created_at', '>=', query.from);
    if (query.to) qb = qb.where('created_at', '<=', query.to);
    qb = qb.orderBy('created_at', 'desc');
    if (query.limit) qb = qb.limit(query.limit);
    if (query.offset) qb = qb.offset(query.offset);
    const rows = await qb;
    return rows.map((r: any) => ({
      id: r.id,
      providerId: r.provider_id,
      modelId: r.model_id,
      userEntityRef: r.user_entity_ref,
      promptTokens: r.prompt_tokens,
      completionTokens: r.completion_tokens,
      timestamp: r.created_at,
    }));
  }

  async summarize(query: AiUsageQuery): Promise<AiUsageSummary> {
    const records = await this.query({
      ...query,
      limit: undefined,
      offset: undefined,
    });
    const byProvider: AiUsageSummary['byProvider'] = {};
    const byModel: AiUsageSummary['byModel'] = {};
    let totalRequests = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    for (const r of records) {
      totalRequests++;
      totalPromptTokens += r.promptTokens;
      totalCompletionTokens += r.completionTokens;
      const p =
        byProvider[r.providerId] ??
        (byProvider[r.providerId] = {
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
        });
      p.requests++;
      p.promptTokens += r.promptTokens;
      p.completionTokens += r.completionTokens;
      const m =
        byModel[r.modelId] ??
        (byModel[r.modelId] = {
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
        });
      m.requests++;
      m.promptTokens += r.promptTokens;
      m.completionTokens += r.completionTokens;
    }
    return {
      totalRequests,
      totalPromptTokens,
      totalCompletionTokens,
      byProvider,
      byModel,
    };
  }
}
```

- [ ] **Step 4: Create ProviderManager**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { AiProvider } from '@backstage/plugin-ai-gateway-node';
import { AiProviderExtensionPoint } from '@backstage/plugin-ai-gateway-node';
import { AiProviderInfo, AiModel } from '@backstage/plugin-ai-gateway-common';
import { LoggerService } from '@backstage/backend-plugin-api';

export class ProviderManager implements AiProviderExtensionPoint {
  private readonly providers = new Map<string, AiProvider>();

  constructor(private readonly logger: LoggerService) {}

  registerProvider(provider: AiProvider): void {
    if (this.providers.has(provider.providerId)) {
      throw new Error(
        `AI provider '${provider.providerId}' is already registered`,
      );
    }
    this.providers.set(provider.providerId, provider);
    this.logger.info(`Registered AI provider: ${provider.providerId}`);
  }

  getProvider(providerId: string): AiProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(
        `AI provider '${providerId}' not found. Available: ${[
          ...this.providers.keys(),
        ].join(', ')}`,
      );
    }
    return provider;
  }

  getProviderForModel(modelId: string): AiProvider {
    for (const provider of this.providers.values()) {
      const caps = provider.getCapabilities();
      if (caps.supportedModels.some(m => m.id === modelId)) {
        return provider;
      }
    }
    throw new Error(`No provider found for model '${modelId}'`);
  }

  async listProviders(): Promise<AiProviderInfo[]> {
    const result: AiProviderInfo[] = [];
    for (const provider of this.providers.values()) {
      const caps = provider.getCapabilities();
      result.push({
        providerId: provider.providerId,
        displayName: caps.displayName,
        status: 'connected',
        modelCount: caps.supportedModels.length,
      });
    }
    return result;
  }

  async listAllModels(): Promise<AiModel[]> {
    const models: AiModel[] = [];
    for (const provider of this.providers.values()) {
      const providerModels = await provider.listModels();
      models.push(...providerModels);
    }
    return models;
  }
}
```

- [ ] **Step 5: Create router**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { Router } from 'express';
import {
  HttpAuthService,
  AuthService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { ProviderManager } from './ProviderManager';
import { UsageTracker } from './UsageTracker';
import { AiChatRequest } from '@backstage/plugin-ai-gateway-common';

export interface RouterOptions {
  providerManager: ProviderManager;
  usageTracker: UsageTracker;
  httpAuth: HttpAuthService;
  auth: AuthService;
  logger: LoggerService;
}

export function createRouter(options: RouterOptions): Router {
  const { providerManager, usageTracker, httpAuth, logger } = options;
  const router = Router();

  router.get('/providers', async (_req, res) => {
    const providers = await providerManager.listProviders();
    res.json(providers);
  });

  router.get('/models', async (_req, res) => {
    const models = await providerManager.listAllModels();
    res.json(models);
  });

  router.post('/chat', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const userEntityRef = credentials.principal.userEntityRef;
    const chatRequest = req.body as AiChatRequest;

    const provider = chatRequest.modelId
      ? providerManager.getProviderForModel(chatRequest.modelId)
      : providerManager.getProvider(Object.keys(providerManager)[0]!);

    if (chatRequest.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let totalPrompt = 0;
      let totalCompletion = 0;
      for await (const chunk of provider.chatStream(chatRequest)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if (chunk.usage) {
          totalPrompt = chunk.usage.promptTokens;
          totalCompletion = chunk.usage.completionTokens;
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();

      await usageTracker.record({
        providerId: provider.providerId,
        modelId: chatRequest.modelId,
        userEntityRef,
        promptTokens: totalPrompt,
        completionTokens: totalCompletion,
      });
    } else {
      const response = await provider.chat(chatRequest);
      await usageTracker.record({
        providerId: provider.providerId,
        modelId: chatRequest.modelId,
        userEntityRef,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
      });
      res.json(response);
    }
  });

  router.get('/usage', async (req, res) => {
    const query = {
      providerId: req.query.providerId as string | undefined,
      modelId: req.query.modelId as string | undefined,
      userEntityRef: req.query.userEntityRef as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    };
    const records = await usageTracker.query(query);
    res.json(records);
  });

  router.get('/usage/summary', async (req, res) => {
    const query = {
      providerId: req.query.providerId as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    };
    const summary = await usageTracker.summarize(query);
    res.json(summary);
  });

  return router;
}
```

- [ ] **Step 6: Write router test**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { mockServices } from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';
import { createRouter } from './router';
import { ProviderManager } from './ProviderManager';
import { UsageTracker } from './UsageTracker';

describe('createRouter', () => {
  let app: express.Express;

  beforeEach(async () => {
    const logger = mockServices.logger.mock();
    const providerManager = new ProviderManager(logger);
    const mockDb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue(undefined),
      from: jest.fn().mockReturnThis(),
    } as any;
    const usageTracker = new UsageTracker(mockDb);

    const router = createRouter({
      providerManager,
      usageTracker,
      httpAuth: mockServices.httpAuth.mock(),
      auth: mockServices.auth.mock(),
      logger,
    });

    app = express();
    app.use(router);
  });

  it('returns empty providers list', async () => {
    const res = await request(app).get('/providers');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns empty models list', async () => {
    const res = await request(app).get('/models');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
```

- [ ] **Step 7: Run test**

Run: `CI=1 yarn test plugins/ai-gateway-backend 2>&1 | tail -20`
Expected: Tests pass

- [ ] **Step 8: Create plugin.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { aiProviderExtensionPoint } from '@backstage/plugin-ai-gateway-node';
import { createRouter } from './service/router';
import { ProviderManager } from './service/ProviderManager';
import { UsageTracker } from './service/UsageTracker';

export const aiGatewayPlugin = createBackendPlugin({
  pluginId: 'ai-gateway',
  register(env) {
    const providerManager = new ProviderManager(env.logger);

    env.registerExtensionPoint(aiProviderExtensionPoint, providerManager);

    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        database: coreServices.database,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        auth: coreServices.auth,
      },
      async init({ logger, database, httpRouter, httpAuth, auth }) {
        const knex = await database.getClient();

        // Run migration
        if (!(await knex.schema.hasTable('ai_gateway_usage'))) {
          await knex.schema.createTable('ai_gateway_usage', table => {
            table.uuid('id').primary().defaultTo(knex.fn.uuid());
            table.string('provider_id').notNullable();
            table.string('model_id').notNullable();
            table.string('user_entity_ref').notNullable();
            table.integer('prompt_tokens').notNullable();
            table.integer('completion_tokens').notNullable();
            table
              .timestamp('created_at')
              .defaultTo(knex.fn.now())
              .notNullable();
            table.index(['provider_id']);
            table.index(['user_entity_ref']);
            table.index(['created_at']);
          });
        }

        const usageTracker = new UsageTracker(knex);

        const router = createRouter({
          providerManager,
          usageTracker,
          httpAuth,
          auth,
          logger,
        });

        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/providers',
          allow: 'unauthenticated',
        });
      },
    });
  },
});
```

- [ ] **Step 9: Create index.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

export { aiGatewayPlugin as default } from './plugin';
```

- [ ] **Step 10: Commit**

```bash
git add plugins/ai-gateway-backend/
git commit -s -m "feat(ai-gateway): add backend plugin with router, usage tracking, and provider manager"
```

---

### Task 4: AI Gateway Frontend

**Files:**

- Create: `plugins/ai-gateway/package.json`
- Create: `plugins/ai-gateway/src/index.ts`
- Create: `plugins/ai-gateway/src/alpha/index.ts`
- Create: `plugins/ai-gateway/src/alpha/plugin.tsx`
- Create: `plugins/ai-gateway/src/alpha/pages.tsx`
- Create: `plugins/ai-gateway/src/components/ProvidersPage.tsx`
- Create: `plugins/ai-gateway/src/components/ModelsPage.tsx`
- Create: `plugins/ai-gateway/src/components/UsagePage.tsx`
- Create: `plugins/ai-gateway/src/api/AiGatewayClient.ts`

**Interfaces:**

- Consumes: AI Gateway Backend REST API (`/api/ai-gateway/*`)
- Produces: Frontend plugin with provider management, model browser, usage dashboard pages

- [ ] **Step 1: Create AiGatewayClient API**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { createApiRef } from '@backstage/frontend-plugin-api';
import {
  AiProviderInfo,
  AiModel,
  AiUsageRecord,
  AiUsageSummary,
  AiUsageQuery,
} from '@backstage/plugin-ai-gateway-common';

export const aiGatewayApiRef = createApiRef<AiGatewayApi>({
  id: 'plugin.ai-gateway.api',
});

export interface AiGatewayApi {
  listProviders(): Promise<AiProviderInfo[]>;
  listModels(): Promise<AiModel[]>;
  getUsage(query: AiUsageQuery): Promise<AiUsageRecord[]>;
  getUsageSummary(query: AiUsageQuery): Promise<AiUsageSummary>;
}

export class AiGatewayClient implements AiGatewayApi {
  private readonly fetchApi: { fetch: typeof fetch };
  private readonly discoveryApi: {
    getBaseUrl(pluginId: string): Promise<string>;
  };

  constructor(options: {
    fetchApi: { fetch: typeof fetch };
    discoveryApi: { getBaseUrl(pluginId: string): Promise<string> };
  }) {
    this.fetchApi = options.fetchApi;
    this.discoveryApi = options.discoveryApi;
  }

  async listProviders(): Promise<AiProviderInfo[]> {
    const baseUrl = await this.discoveryApi.getBaseUrl('ai-gateway');
    const res = await this.fetchApi.fetch(`${baseUrl}/providers`);
    return res.json();
  }

  async listModels(): Promise<AiModel[]> {
    const baseUrl = await this.discoveryApi.getBaseUrl('ai-gateway');
    const res = await this.fetchApi.fetch(`${baseUrl}/models`);
    return res.json();
  }

  async getUsage(query: AiUsageQuery): Promise<AiUsageRecord[]> {
    const baseUrl = await this.discoveryApi.getBaseUrl('ai-gateway');
    const params = new URLSearchParams();
    if (query.providerId) params.set('providerId', query.providerId);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    const res = await this.fetchApi.fetch(`${baseUrl}/usage?${params}`);
    return res.json();
  }

  async getUsageSummary(query: AiUsageQuery): Promise<AiUsageSummary> {
    const baseUrl = await this.discoveryApi.getBaseUrl('ai-gateway');
    const params = new URLSearchParams();
    if (query.providerId) params.set('providerId', query.providerId);
    if (query.from) params.set('from', query.from);
    if (query.to) params.set('to', query.to);
    const res = await this.fetchApi.fetch(`${baseUrl}/usage/summary?${params}`);
    return res.json();
  }
}
```

- [ ] **Step 2: Create ProvidersPage component**

```tsx
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import React, { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  Table,
  TableColumn,
  StatusOK,
  StatusError,
  Page,
  Header,
  Content,
} from '@backstage/core-components';
import { aiGatewayApiRef } from '../api/AiGatewayClient';
import { AiProviderInfo } from '@backstage/plugin-ai-gateway-common';

const columns: TableColumn<AiProviderInfo>[] = [
  { title: 'Provider', field: 'providerId' },
  { title: 'Display Name', field: 'displayName' },
  {
    title: 'Status',
    render: (row: AiProviderInfo) =>
      row.status === 'connected' ? (
        <StatusOK>Connected</StatusOK>
      ) : (
        <StatusError>Error</StatusError>
      ),
  },
  { title: 'Models', field: 'modelCount', type: 'numeric' },
];

export function ProvidersPage(): React.JSX.Element {
  const api = useApi(aiGatewayApiRef);
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listProviders().then(p => {
      setProviders(p);
      setLoading(false);
    });
  }, [api]);

  return (
    <Page themeId="tool">
      <Header title="AI Providers" subtitle="Manage AI model providers" />
      <Content>
        <Table
          title="Registered Providers"
          columns={columns}
          data={providers}
          isLoading={loading}
          options={{ paging: false }}
        />
      </Content>
    </Page>
  );
}
```

- [ ] **Step 3: Create plugin.tsx with new frontend system**

```tsx
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import {
  createFrontendPlugin,
  createPageExtension,
  createApiExtension,
  createApiFactory,
} from '@backstage/frontend-plugin-api';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { aiGatewayApiRef, AiGatewayClient } from '../api/AiGatewayClient';

const aiGatewayApiExtension = createApiExtension({
  factory: createApiFactory({
    api: aiGatewayApiRef,
    deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
    factory: ({ discoveryApi, fetchApi }) =>
      new AiGatewayClient({ discoveryApi, fetchApi }),
  }),
});

const aiGatewayProvidersPage = createPageExtension({
  defaultPath: '/ai-gateway',
  loader: () =>
    import('../components/ProvidersPage').then(m => <m.ProvidersPage />),
});

export default createFrontendPlugin({
  pluginId: 'ai-gateway',
  extensions: [aiGatewayApiExtension, aiGatewayProvidersPage],
});
```

- [ ] **Step 4: Create index.ts files and commit**

```bash
git add plugins/ai-gateway/
git commit -s -m "feat(ai-gateway): add frontend plugin with providers, models, and usage pages"
```

---

### Task 5: Anthropic Provider Module

**Files:**

- Create: `plugins/ai-gateway-backend-module-anthropic/package.json`
- Create: `plugins/ai-gateway-backend-module-anthropic/src/index.ts`
- Create: `plugins/ai-gateway-backend-module-anthropic/src/module.ts`
- Create: `plugins/ai-gateway-backend-module-anthropic/src/provider.ts`
- Create: `plugins/ai-gateway-backend-module-anthropic/src/provider.test.ts`
- Create: `plugins/ai-gateway-backend-module-anthropic/config.d.ts`

**Interfaces:**

- Consumes: `aiProviderExtensionPoint` from `@backstage/plugin-ai-gateway-node`, Anthropic SDK
- Produces: Anthropic AI provider registered into the gateway

- [ ] **Step 1: Create config.d.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

export interface Config {
  aiGateway?: {
    providers?: {
      anthropic?: {
        /**
         * Anthropic API key
         * @visibility secret
         */
        apiKey: string;
        /** Base URL override for proxy/enterprise deployments */
        baseUrl?: string;
      };
    };
  };
}
```

- [ ] **Step 2: Create provider.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import Anthropic from '@anthropic-ai/sdk';
import { AiProvider } from '@backstage/plugin-ai-gateway-node';
import {
  AiChatRequest,
  AiChatChunk,
  AiChatResponse,
  AiModel,
  AiProviderCapabilities,
} from '@backstage/plugin-ai-gateway-common';
import { LoggerService } from '@backstage/backend-plugin-api';

export class AnthropicProvider implements AiProvider {
  readonly providerId = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    private readonly config: { apiKey: string; baseUrl?: string },
    private readonly logger: LoggerService,
  ) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const messages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const response = await this.client.messages.create({
      model: request.modelId,
      max_tokens: request.maxTokens ?? 4096,
      system: request.system,
      messages,
      temperature: request.temperature,
    });

    const content = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    return {
      content,
      modelId: request.modelId,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async *chatStream(request: AiChatRequest): AsyncIterable<AiChatChunk> {
    const messages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const stream = this.client.messages.stream({
      model: request.modelId,
      max_tokens: request.maxTokens ?? 4096,
      system: request.system,
      messages,
      temperature: request.temperature,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield { delta: event.delta.text, done: false };
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      delta: '',
      done: true,
      usage: {
        promptTokens: finalMessage.usage.input_tokens,
        completionTokens: finalMessage.usage.output_tokens,
        totalTokens:
          finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
      },
    };
  }

  async listModels(): Promise<AiModel[]> {
    return [
      {
        id: 'claude-sonnet-4-20250514',
        providerId: 'anthropic',
        name: 'Claude Sonnet 4',
        capabilities: {
          chat: true,
          streaming: true,
          vision: true,
          toolUse: true,
          maxContextTokens: 200000,
          maxOutputTokens: 64000,
        },
      },
      {
        id: 'claude-opus-4-20250514',
        providerId: 'anthropic',
        name: 'Claude Opus 4',
        capabilities: {
          chat: true,
          streaming: true,
          vision: true,
          toolUse: true,
          maxContextTokens: 200000,
          maxOutputTokens: 32000,
        },
      },
      {
        id: 'claude-haiku-3-5-20241022',
        providerId: 'anthropic',
        name: 'Claude 3.5 Haiku',
        capabilities: {
          chat: true,
          streaming: true,
          vision: true,
          toolUse: true,
          maxContextTokens: 200000,
          maxOutputTokens: 8192,
        },
      },
    ];
  }

  getCapabilities(): AiProviderCapabilities {
    return {
      providerId: 'anthropic',
      displayName: 'Anthropic',
      supportedModels: [], // populated dynamically via listModels
    };
  }
}
```

- [ ] **Step 3: Create module.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import { aiProviderExtensionPoint } from '@backstage/plugin-ai-gateway-node';
import { AnthropicProvider } from './provider';

export const aiGatewayModuleAnthropic = createBackendModule({
  pluginId: 'ai-gateway',
  moduleId: 'anthropic',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        providers: aiProviderExtensionPoint,
      },
      async init({ config, logger, providers }) {
        const providerConfig = config.getOptionalConfig(
          'aiGateway.providers.anthropic',
        );
        if (!providerConfig) {
          logger.warn('Anthropic provider not configured — skipping');
          return;
        }
        const apiKey = providerConfig.getString('apiKey');
        const baseUrl = providerConfig.getOptionalString('baseUrl');
        providers.registerProvider(
          new AnthropicProvider({ apiKey, baseUrl }, logger),
        );
      },
    });
  },
});
```

- [ ] **Step 4: Create index.ts and test**

`src/index.ts`:

```ts
export { aiGatewayModuleAnthropic as default } from './module';
```

`src/provider.test.ts`:

```ts
import { AnthropicProvider } from './provider';
import { mockServices } from '@backstage/backend-test-utils';

describe('AnthropicProvider', () => {
  it('has correct providerId', () => {
    const provider = new AnthropicProvider(
      { apiKey: 'test-key' },
      mockServices.logger.mock(),
    );
    expect(provider.providerId).toBe('anthropic');
  });

  it('lists known models', async () => {
    const provider = new AnthropicProvider(
      { apiKey: 'test-key' },
      mockServices.logger.mock(),
    );
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].providerId).toBe('anthropic');
  });

  it('returns capabilities', () => {
    const provider = new AnthropicProvider(
      { apiKey: 'test-key' },
      mockServices.logger.mock(),
    );
    const caps = provider.getCapabilities();
    expect(caps.providerId).toBe('anthropic');
    expect(caps.displayName).toBe('Anthropic');
  });
});
```

- [ ] **Step 5: Run test and commit**

Run: `CI=1 yarn test plugins/ai-gateway-backend-module-anthropic 2>&1 | tail -10`

```bash
git add plugins/ai-gateway-backend-module-anthropic/
git commit -s -m "feat(ai-gateway): add Anthropic provider module"
```

---

### Task 6: OpenAI Provider Module

**Files:**

- Create: `plugins/ai-gateway-backend-module-openai/` (same structure as Anthropic)

**Interfaces:**

- Consumes: `aiProviderExtensionPoint`, OpenAI SDK
- Produces: OpenAI provider with GPT-4o, GPT-4o-mini models

- [ ] **Step 1: Create config.d.ts**

```ts
export interface Config {
  aiGateway?: {
    providers?: {
      openai?: {
        /** @visibility secret */
        apiKey: string;
        /** Organization ID */
        organization?: string;
        baseUrl?: string;
      };
    };
  };
}
```

- [ ] **Step 2: Create provider.ts**

```ts
import OpenAI from 'openai';
import { AiProvider } from '@backstage/plugin-ai-gateway-node';
import {
  AiChatRequest,
  AiChatChunk,
  AiChatResponse,
  AiModel,
  AiProviderCapabilities,
} from '@backstage/plugin-ai-gateway-common';
import { LoggerService } from '@backstage/backend-plugin-api';

export class OpenAiProvider implements AiProvider {
  readonly providerId = 'openai';
  private readonly client: OpenAI;

  constructor(
    private readonly config: {
      apiKey: string;
      organization?: string;
      baseUrl?: string;
    },
    private readonly logger: LoggerService,
  ) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      baseURL: config.baseUrl,
    });
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const response = await this.client.chat.completions.create({
      model: request.modelId,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: request.maxTokens,
      temperature: request.temperature,
    });
    const choice = response.choices[0];
    return {
      content: choice?.message?.content ?? '',
      modelId: request.modelId,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
    };
  }

  async *chatStream(request: AiChatRequest): AsyncIterable<AiChatChunk> {
    const stream = await this.client.chat.completions.create({
      model: request.modelId,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      const done =
        chunk.choices[0]?.finish_reason !== null &&
        chunk.choices[0]?.finish_reason !== undefined;
      yield {
        delta,
        done,
        usage: done
          ? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
          : undefined,
      };
    }
  }

  async listModels(): Promise<AiModel[]> {
    return [
      {
        id: 'gpt-4o',
        providerId: 'openai',
        name: 'GPT-4o',
        capabilities: {
          chat: true,
          streaming: true,
          vision: true,
          toolUse: true,
          maxContextTokens: 128000,
          maxOutputTokens: 16384,
        },
      },
      {
        id: 'gpt-4o-mini',
        providerId: 'openai',
        name: 'GPT-4o Mini',
        capabilities: {
          chat: true,
          streaming: true,
          vision: false,
          toolUse: true,
          maxContextTokens: 128000,
          maxOutputTokens: 16384,
        },
      },
    ];
  }

  getCapabilities(): AiProviderCapabilities {
    return { providerId: 'openai', displayName: 'OpenAI', supportedModels: [] };
  }
}
```

- [ ] **Step 3: Create module.ts, index.ts, test, commit**

Module follows identical pattern to Anthropic — reads `aiGateway.providers.openai` config, registers `OpenAiProvider`.

```bash
git add plugins/ai-gateway-backend-module-openai/
git commit -s -m "feat(ai-gateway): add OpenAI provider module"
```

---

### Task 7: Ollama Provider Module

**Files:**

- Create: `plugins/ai-gateway-backend-module-ollama/` (same structure)

**Interfaces:**

- Consumes: `aiProviderExtensionPoint`, native `fetch` (Ollama uses HTTP API, no SDK needed)
- Produces: Ollama provider for self-hosted models

- [ ] **Step 1: Create config.d.ts**

```ts
export interface Config {
  aiGateway?: {
    providers?: {
      ollama?: {
        /** Ollama server URL, e.g. http://localhost:11434 */
        baseUrl: string;
      };
    };
  };
}
```

- [ ] **Step 2: Create provider.ts**

```ts
import { AiProvider } from '@backstage/plugin-ai-gateway-node';
import {
  AiChatRequest,
  AiChatChunk,
  AiChatResponse,
  AiModel,
  AiProviderCapabilities,
} from '@backstage/plugin-ai-gateway-common';
import { LoggerService } from '@backstage/backend-plugin-api';

export class OllamaProvider implements AiProvider {
  readonly providerId = 'ollama';

  constructor(
    private readonly baseUrl: string,
    private readonly logger: LoggerService,
  ) {}

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.modelId,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
      }),
    });
    const data = await res.json();
    return {
      content: data.message?.content ?? '',
      modelId: request.modelId,
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
    };
  }

  async *chatStream(request: AiChatRequest): AsyncIterable<AiChatChunk> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.modelId,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      }),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done: readerDone, value } = await reader.read();
      if (readerDone) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop()!;
      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line);
        yield {
          delta: parsed.message?.content ?? '',
          done: parsed.done ?? false,
          usage: parsed.done
            ? {
                promptTokens: parsed.prompt_eval_count ?? 0,
                completionTokens: parsed.eval_count ?? 0,
                totalTokens:
                  (parsed.prompt_eval_count ?? 0) + (parsed.eval_count ?? 0),
              }
            : undefined,
        };
      }
    }
  }

  async listModels(): Promise<AiModel[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    const data = await res.json();
    return (data.models ?? []).map((m: any) => ({
      id: m.name,
      providerId: 'ollama',
      name: m.name,
      capabilities: {
        chat: true,
        streaming: true,
        vision: false,
        toolUse: false,
        maxContextTokens: m.details?.context_length ?? 4096,
        maxOutputTokens: m.details?.context_length ?? 4096,
      },
    }));
  }

  getCapabilities(): AiProviderCapabilities {
    return {
      providerId: 'ollama',
      displayName: 'Ollama (Self-hosted)',
      supportedModels: [],
    };
  }
}
```

- [ ] **Step 3: Create module, index, test, commit**

```bash
git add plugins/ai-gateway-backend-module-ollama/
git commit -s -m "feat(ai-gateway): add Ollama self-hosted provider module"
```

---

### Task 8: AWS Bedrock Provider Module

**Files:**

- Create: `plugins/ai-gateway-backend-module-bedrock/` (same structure)

**Interfaces:**

- Consumes: `aiProviderExtensionPoint`, `@aws-sdk/client-bedrock-runtime`
- Produces: Bedrock provider for AWS-managed models

- [ ] **Step 1: Create config.d.ts**

```ts
export interface Config {
  aiGateway?: {
    providers?: {
      bedrock?: {
        /** AWS region, e.g. us-east-1 */
        region: string;
        /** @visibility secret */
        accessKeyId?: string;
        /** @visibility secret */
        secretAccessKey?: string;
      };
    };
  };
}
```

- [ ] **Step 2: Create provider.ts**

```ts
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { AiProvider } from '@backstage/plugin-ai-gateway-node';
import {
  AiChatRequest,
  AiChatChunk,
  AiChatResponse,
  AiModel,
  AiProviderCapabilities,
} from '@backstage/plugin-ai-gateway-common';
import { LoggerService } from '@backstage/backend-plugin-api';

export class BedrockProvider implements AiProvider {
  readonly providerId = 'bedrock';
  private readonly client: BedrockRuntimeClient;

  constructor(
    private readonly config: {
      region: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    },
    private readonly logger: LoggerService,
  ) {
    this.client = new BedrockRuntimeClient({
      region: config.region,
      ...(config.accessKeyId && config.secretAccessKey
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }
        : {}),
    });
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: request.maxTokens ?? 4096,
      system: request.system,
      messages: request.messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content })),
    });

    const command = new InvokeModelCommand({
      modelId: request.modelId,
      body: new TextEncoder().encode(body),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await this.client.send(command);
    const parsed = JSON.parse(new TextDecoder().decode(response.body));

    return {
      content: parsed.content?.[0]?.text ?? '',
      modelId: request.modelId,
      usage: {
        promptTokens: parsed.usage?.input_tokens ?? 0,
        completionTokens: parsed.usage?.output_tokens ?? 0,
        totalTokens:
          (parsed.usage?.input_tokens ?? 0) +
          (parsed.usage?.output_tokens ?? 0),
      },
    };
  }

  async *chatStream(request: AiChatRequest): AsyncIterable<AiChatChunk> {
    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: request.maxTokens ?? 4096,
      system: request.system,
      messages: request.messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content })),
    });

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: request.modelId,
      body: new TextEncoder().encode(body),
      contentType: 'application/json',
    });

    const response = await this.client.send(command);
    if (response.body) {
      for await (const event of response.body) {
        if (event.chunk?.bytes) {
          const parsed = JSON.parse(
            new TextDecoder().decode(event.chunk.bytes),
          );
          if (parsed.type === 'content_block_delta') {
            yield { delta: parsed.delta?.text ?? '', done: false };
          } else if (parsed.type === 'message_stop') {
            yield {
              delta: '',
              done: true,
              usage: {
                promptTokens: parsed.usage?.input_tokens ?? 0,
                completionTokens: parsed.usage?.output_tokens ?? 0,
                totalTokens: 0,
              },
            };
          }
        }
      }
    }
  }

  async listModels(): Promise<AiModel[]> {
    return [
      {
        id: 'anthropic.claude-sonnet-4-20250514-v1:0',
        providerId: 'bedrock',
        name: 'Claude Sonnet 4 (Bedrock)',
        capabilities: {
          chat: true,
          streaming: true,
          vision: true,
          toolUse: true,
          maxContextTokens: 200000,
          maxOutputTokens: 64000,
        },
      },
      {
        id: 'anthropic.claude-haiku-3-5-20241022-v1:0',
        providerId: 'bedrock',
        name: 'Claude 3.5 Haiku (Bedrock)',
        capabilities: {
          chat: true,
          streaming: true,
          vision: true,
          toolUse: true,
          maxContextTokens: 200000,
          maxOutputTokens: 8192,
        },
      },
    ];
  }

  getCapabilities(): AiProviderCapabilities {
    return {
      providerId: 'bedrock',
      displayName: 'AWS Bedrock',
      supportedModels: [],
    };
  }
}
```

- [ ] **Step 3: Create module, index, test, commit**

```bash
git add plugins/ai-gateway-backend-module-bedrock/
git commit -s -m "feat(ai-gateway): add AWS Bedrock provider module"
```

---

### Task 9: AI Assistant Common Package

**Files:**

- Create: `plugins/ai-assistant-common/package.json`
- Create: `plugins/ai-assistant-common/src/index.ts`
- Create: `plugins/ai-assistant-common/src/types.ts`
- Create: `plugins/ai-assistant-common/src/permissions.ts`

**Interfaces:**

- Consumes: `@backstage/plugin-permission-common`
- Produces: `AiConversation`, `AiAssistantMessage`, `AiAssistantMode`, `KnowledgeChunk`, permission definitions

- [ ] **Step 1: Create types.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

export interface AiConversation {
  id: string;
  title: string;
  modeId: string;
  userEntityRef: string;
  messages: AiAssistantMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AiAssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: KnowledgeChunk[];
  timestamp: string;
}

export interface AiAssistantMode {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  knowledgeSources: string[];
  modelId?: string;
  icon?: string;
}

export interface KnowledgeChunk {
  sourceId: string;
  content: string;
  metadata: Record<string, string>;
  score: number;
}

export interface KnowledgeSearchOptions {
  maxResults?: number;
  minScore?: number;
  entityRef?: string;
}

export interface ConversationQuery {
  userEntityRef?: string;
  modeId?: string;
  limit?: number;
  offset?: number;
}

export interface CreateConversationRequest {
  title?: string;
  modeId: string;
}

export interface SendMessageRequest {
  content: string;
  stream?: boolean;
}
```

- [ ] **Step 2: Create permissions.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { createPermission } from '@backstage/plugin-permission-common';

export const aiAssistantChatPermission = createPermission({
  name: 'ai.assistant.chat',
  attributes: { action: 'create' },
});

export const aiAssistantAdminPermission = createPermission({
  name: 'ai.assistant.admin',
  attributes: { action: 'update' },
});

export const aiAssistantPermissions = [
  aiAssistantChatPermission,
  aiAssistantAdminPermission,
];
```

- [ ] **Step 3: Create index.ts and commit**

```ts
export {
  type AiConversation,
  type AiAssistantMessage,
  type AiAssistantMode,
  type KnowledgeChunk,
  type KnowledgeSearchOptions,
  type ConversationQuery,
  type CreateConversationRequest,
  type SendMessageRequest,
} from './types';
export {
  aiAssistantChatPermission,
  aiAssistantAdminPermission,
  aiAssistantPermissions,
} from './permissions';
```

```bash
git add plugins/ai-assistant-common/
git commit -s -m "feat(ai-assistant): add common package with conversation, mode, and message types"
```

---

### Task 10: AI Assistant Node Package (Knowledge Source Extension Point)

**Files:**

- Create: `plugins/ai-assistant-node/package.json`
- Create: `plugins/ai-assistant-node/src/index.ts`
- Create: `plugins/ai-assistant-node/src/extensions.ts`
- Create: `plugins/ai-assistant-node/src/types.ts`

**Interfaces:**

- Consumes: `@backstage/plugin-ai-assistant-common`
- Produces: `aiKnowledgeSourceExtensionPoint`, `AiKnowledgeSource` interface

- [ ] **Step 1: Create types.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import {
  KnowledgeChunk,
  KnowledgeSearchOptions,
} from '@backstage/plugin-ai-assistant-common';

/** Interface that knowledge source modules must implement */
export interface AiKnowledgeSource {
  /** Unique source identifier, e.g. 'techdocs', 'catalog' */
  readonly sourceId: string;

  /** Human-readable name */
  readonly displayName: string;

  /** Search this knowledge source for relevant content */
  search(
    query: string,
    options?: KnowledgeSearchOptions,
  ): Promise<KnowledgeChunk[]>;
}
```

- [ ] **Step 2: Create extensions.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { createExtensionPoint } from '@backstage/backend-plugin-api';
import { AiKnowledgeSource } from './types';

export const aiKnowledgeSourceExtensionPoint =
  createExtensionPoint<AiKnowledgeSourceExtensionPoint>({
    id: 'ai-assistant.knowledge-sources',
  });

export interface AiKnowledgeSourceExtensionPoint {
  registerSource(source: AiKnowledgeSource): void;
}
```

- [ ] **Step 3: Create index.ts and commit**

```ts
export { type AiKnowledgeSource } from './types';
export {
  aiKnowledgeSourceExtensionPoint,
  type AiKnowledgeSourceExtensionPoint,
} from './extensions';
```

```bash
git add plugins/ai-assistant-node/
git commit -s -m "feat(ai-assistant): add node package with knowledge source extension point"
```

---

### Task 11: AI Assistant Backend

**Files:**

- Create: `plugins/ai-assistant-backend/package.json`
- Create: `plugins/ai-assistant-backend/src/index.ts`
- Create: `plugins/ai-assistant-backend/src/plugin.ts`
- Create: `plugins/ai-assistant-backend/src/service/router.ts`
- Create: `plugins/ai-assistant-backend/src/service/router.test.ts`
- Create: `plugins/ai-assistant-backend/src/service/ConversationStore.ts`
- Create: `plugins/ai-assistant-backend/src/service/ModeRegistry.ts`
- Create: `plugins/ai-assistant-backend/src/service/RagPipeline.ts`
- Create: `plugins/ai-assistant-backend/src/service/KnowledgeSourceManager.ts`
- Create: `plugins/ai-assistant-backend/config.d.ts`

**Interfaces:**

- Consumes: `aiKnowledgeSourceExtensionPoint`, AI Gateway backend (via service-to-service), `coreServices.database`, `coreServices.httpRouter`, MCP Actions Backend
- Produces: REST API at `/api/ai-assistant/` — `POST /conversations`, `POST /conversations/:id/messages`, `GET /conversations`, `GET /modes`

- [ ] **Step 1: Create config.d.ts**

```ts
export interface Config {
  aiAssistant?: {
    /** Default mode for new conversations */
    defaultMode?: string;
    /** Default model for the assistant */
    defaultModel?: string;
    /** Custom modes configuration */
    modes?: Array<{
      id: string;
      name: string;
      description: string;
      systemPrompt: string;
      knowledgeSources: string[];
      modelId?: string;
    }>;
  };
}
```

- [ ] **Step 2: Create ConversationStore**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { Knex } from 'knex';
import {
  AiConversation,
  AiAssistantMessage,
  ConversationQuery,
} from '@backstage/plugin-ai-assistant-common';
import { v4 as uuid } from 'uuid';

export class ConversationStore {
  constructor(private readonly db: Knex) {}

  async create(params: {
    title: string;
    modeId: string;
    userEntityRef: string;
  }): Promise<AiConversation> {
    const id = uuid();
    const now = new Date().toISOString();
    await this.db('ai_assistant_conversations').insert({
      id,
      title: params.title,
      mode_id: params.modeId,
      user_entity_ref: params.userEntityRef,
      created_at: now,
      updated_at: now,
    });
    return {
      id,
      title: params.title,
      modeId: params.modeId,
      userEntityRef: params.userEntityRef,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  async addMessage(
    conversationId: string,
    message: Omit<AiAssistantMessage, 'id' | 'timestamp'>,
  ): Promise<AiAssistantMessage> {
    const id = uuid();
    const timestamp = new Date().toISOString();
    await this.db('ai_assistant_messages').insert({
      id,
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      sources: message.sources ? JSON.stringify(message.sources) : undefined,
      created_at: timestamp,
    });
    await this.db('ai_assistant_conversations')
      .where({ id: conversationId })
      .update({ updated_at: timestamp });
    return {
      id,
      role: message.role,
      content: message.content,
      sources: message.sources,
      timestamp,
    };
  }

  async list(query: ConversationQuery): Promise<AiConversation[]> {
    let qb = this.db('ai_assistant_conversations').select('*');
    if (query.userEntityRef)
      qb = qb.where('user_entity_ref', query.userEntityRef);
    if (query.modeId) qb = qb.where('mode_id', query.modeId);
    qb = qb.orderBy('updated_at', 'desc');
    if (query.limit) qb = qb.limit(query.limit);
    if (query.offset) qb = qb.offset(query.offset);
    const rows = await qb;
    return rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      modeId: r.mode_id,
      userEntityRef: r.user_entity_ref,
      messages: [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async get(id: string): Promise<AiConversation | undefined> {
    const row = await this.db('ai_assistant_conversations')
      .where({ id })
      .first();
    if (!row) return undefined;
    const msgRows = await this.db('ai_assistant_messages')
      .where({ conversation_id: id })
      .orderBy('created_at', 'asc');
    const messages: AiAssistantMessage[] = msgRows.map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: m.sources ? JSON.parse(m.sources) : undefined,
      timestamp: m.created_at,
    }));
    return {
      id: row.id,
      title: row.title,
      modeId: row.mode_id,
      userEntityRef: row.user_entity_ref,
      messages,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
```

- [ ] **Step 3: Create RagPipeline**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { AiKnowledgeSource } from '@backstage/plugin-ai-assistant-node';
import {
  KnowledgeChunk,
  AiAssistantMode,
} from '@backstage/plugin-ai-assistant-common';
import { LoggerService } from '@backstage/backend-plugin-api';

export class RagPipeline {
  constructor(
    private readonly sources: Map<string, AiKnowledgeSource>,
    private readonly logger: LoggerService,
  ) {}

  async retrieve(
    query: string,
    mode: AiAssistantMode,
  ): Promise<KnowledgeChunk[]> {
    const chunks: KnowledgeChunk[] = [];
    for (const sourceId of mode.knowledgeSources) {
      const source = this.sources.get(sourceId);
      if (!source) {
        this.logger.warn(`Knowledge source '${sourceId}' not found, skipping`);
        continue;
      }
      const results = await source.search(query, {
        maxResults: 5,
        minScore: 0.3,
      });
      chunks.push(...results);
    }
    chunks.sort((a, b) => b.score - a.score);
    return chunks.slice(0, 10);
  }

  buildContext(chunks: KnowledgeChunk[]): string {
    if (chunks.length === 0) return '';
    const contextParts = chunks.map(
      (c, i) => `[Source ${i + 1}: ${c.sourceId}]\n${c.content}`,
    );
    return `\n\nRelevant context:\n${contextParts.join('\n\n')}`;
  }
}
```

- [ ] **Step 4: Create KnowledgeSourceManager**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { AiKnowledgeSource } from '@backstage/plugin-ai-assistant-node';
import { AiKnowledgeSourceExtensionPoint } from '@backstage/plugin-ai-assistant-node';
import { LoggerService } from '@backstage/backend-plugin-api';

export class KnowledgeSourceManager implements AiKnowledgeSourceExtensionPoint {
  private readonly sources = new Map<string, AiKnowledgeSource>();

  constructor(private readonly logger: LoggerService) {}

  registerSource(source: AiKnowledgeSource): void {
    if (this.sources.has(source.sourceId)) {
      throw new Error(
        `Knowledge source '${source.sourceId}' already registered`,
      );
    }
    this.sources.set(source.sourceId, source);
    this.logger.info(`Registered knowledge source: ${source.sourceId}`);
  }

  getSources(): Map<string, AiKnowledgeSource> {
    return this.sources;
  }

  getSource(sourceId: string): AiKnowledgeSource | undefined {
    return this.sources.get(sourceId);
  }
}
```

- [ ] **Step 5: Create router with conversation and chat endpoints**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { Router } from 'express';
import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { ConversationStore } from './ConversationStore';
import { ModeRegistry } from './ModeRegistry';
import { RagPipeline } from './RagPipeline';
import {
  CreateConversationRequest,
  SendMessageRequest,
  AiAssistantMode,
} from '@backstage/plugin-ai-assistant-common';

export interface RouterOptions {
  conversationStore: ConversationStore;
  modeRegistry: ModeRegistry;
  ragPipeline: RagPipeline;
  httpAuth: HttpAuthService;
  logger: LoggerService;
  gatewayBaseUrl: string;
  defaultModel: string;
}

export function createRouter(options: RouterOptions): Router {
  const { conversationStore, modeRegistry, ragPipeline, httpAuth, logger } =
    options;
  const router = Router();

  router.get('/modes', async (_req, res) => {
    const modes = modeRegistry.listModes();
    res.json(modes);
  });

  router.post('/conversations', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const userEntityRef = credentials.principal.userEntityRef;
    const body = req.body as CreateConversationRequest;
    const conversation = await conversationStore.create({
      title: body.title ?? 'New conversation',
      modeId: body.modeId,
      userEntityRef,
    });
    res.status(201).json(conversation);
  });

  router.get('/conversations', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const userEntityRef = credentials.principal.userEntityRef;
    const conversations = await conversationStore.list({
      userEntityRef,
      limit: 50,
    });
    res.json(conversations);
  });

  router.get('/conversations/:id', async (req, res) => {
    const conversation = await conversationStore.get(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json(conversation);
  });

  router.post('/conversations/:id/messages', async (req, res) => {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const body = req.body as SendMessageRequest;
    const conversation = await conversationStore.get(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Save user message
    await conversationStore.addMessage(req.params.id, {
      role: 'user',
      content: body.content,
    });

    // Retrieve context via RAG
    const mode = modeRegistry.getMode(conversation.modeId);
    const chunks = mode ? await ragPipeline.retrieve(body.content, mode) : [];
    const context = ragPipeline.buildContext(chunks);

    // Call AI Gateway (service-to-service)
    const modelId = mode?.modelId ?? options.defaultModel;
    const systemPrompt = (mode?.systemPrompt ?? '') + context;

    const gatewayRes = await fetch(
      `${options.gatewayBaseUrl}/api/ai-gateway/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          system: systemPrompt,
          messages: conversation.messages
            .map(m => ({ role: m.role, content: m.content }))
            .concat([{ role: 'user' as const, content: body.content }]),
          maxTokens: 4096,
          stream: false,
        }),
      },
    );

    const aiResponse = await gatewayRes.json();

    // Save assistant message with sources
    const assistantMsg = await conversationStore.addMessage(req.params.id, {
      role: 'assistant',
      content: aiResponse.content,
      sources: chunks.length > 0 ? chunks : undefined,
    });

    res.json(assistantMsg);
  });

  return router;
}
```

- [ ] **Step 6: Create ModeRegistry**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { AiAssistantMode } from '@backstage/plugin-ai-assistant-common';
import { Config } from '@backstage/config';

export class ModeRegistry {
  private readonly modes = new Map<string, AiAssistantMode>();

  constructor(config: Config) {
    // Load built-in modes
    this.modes.set('general', {
      id: 'general',
      name: 'General Assistant',
      description: 'General-purpose developer assistant',
      systemPrompt:
        'You are a helpful developer portal assistant. Answer questions about the organization, its services, and development practices.',
      knowledgeSources: ['catalog', 'techdocs'],
    });

    this.modes.set('catalog-expert', {
      id: 'catalog-expert',
      name: 'Catalog Expert',
      description: 'Expert on catalog entities, ownership, and dependencies',
      systemPrompt:
        'You are an expert on the software catalog. Help users understand service ownership, dependencies, APIs, and component relationships.',
      knowledgeSources: ['catalog'],
    });

    // Load custom modes from config
    const customModes =
      config.getOptionalConfigArray('aiAssistant.modes') ?? [];
    for (const modeConfig of customModes) {
      const mode: AiAssistantMode = {
        id: modeConfig.getString('id'),
        name: modeConfig.getString('name'),
        description: modeConfig.getString('description'),
        systemPrompt: modeConfig.getString('systemPrompt'),
        knowledgeSources: modeConfig.getStringArray('knowledgeSources'),
        modelId: modeConfig.getOptionalString('modelId'),
      };
      this.modes.set(mode.id, mode);
    }
  }

  getMode(id: string): AiAssistantMode | undefined {
    return this.modes.get(id);
  }

  listModes(): AiAssistantMode[] {
    return [...this.modes.values()];
  }
}
```

- [ ] **Step 7: Create plugin.ts, index.ts, test, run test, commit**

Plugin wires `aiKnowledgeSourceExtensionPoint`, creates tables, initializes `ConversationStore`, `ModeRegistry`, `RagPipeline`, `KnowledgeSourceManager`, mounts router.

```bash
git add plugins/ai-assistant-backend/
git commit -s -m "feat(ai-assistant): add backend with conversation store, RAG pipeline, mode registry"
```

---

### Task 12: AI Assistant Frontend

**Files:**

- Create: `plugins/ai-assistant/package.json`
- Create: `plugins/ai-assistant/src/index.ts`
- Create: `plugins/ai-assistant/src/alpha/plugin.tsx`
- Create: `plugins/ai-assistant/src/components/ChatPage.tsx`
- Create: `plugins/ai-assistant/src/components/ChatMessage.tsx`
- Create: `plugins/ai-assistant/src/components/ModeSelector.tsx`
- Create: `plugins/ai-assistant/src/components/ConversationList.tsx`
- Create: `plugins/ai-assistant/src/api/AiAssistantClient.ts`

**Interfaces:**

- Consumes: AI Assistant Backend REST API (`/api/ai-assistant/*`)
- Produces: Frontend plugin with chat UI, mode selector, conversation sidebar

- [ ] **Step 1: Create AiAssistantClient**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { createApiRef } from '@backstage/frontend-plugin-api';
import {
  AiConversation,
  AiAssistantMessage,
  AiAssistantMode,
  CreateConversationRequest,
  SendMessageRequest,
} from '@backstage/plugin-ai-assistant-common';

export const aiAssistantApiRef = createApiRef<AiAssistantApi>({
  id: 'plugin.ai-assistant.api',
});

export interface AiAssistantApi {
  listModes(): Promise<AiAssistantMode[]>;
  listConversations(): Promise<AiConversation[]>;
  getConversation(id: string): Promise<AiConversation>;
  createConversation(
    request: CreateConversationRequest,
  ): Promise<AiConversation>;
  sendMessage(
    conversationId: string,
    request: SendMessageRequest,
  ): Promise<AiAssistantMessage>;
}

export class AiAssistantClient implements AiAssistantApi {
  private readonly fetchApi: { fetch: typeof fetch };
  private readonly discoveryApi: {
    getBaseUrl(pluginId: string): Promise<string>;
  };

  constructor(options: {
    fetchApi: { fetch: typeof fetch };
    discoveryApi: { getBaseUrl(pluginId: string): Promise<string> };
  }) {
    this.fetchApi = options.fetchApi;
    this.discoveryApi = options.discoveryApi;
  }

  private async baseUrl(): Promise<string> {
    return this.discoveryApi.getBaseUrl('ai-assistant');
  }

  async listModes(): Promise<AiAssistantMode[]> {
    const res = await this.fetchApi.fetch(`${await this.baseUrl()}/modes`);
    return res.json();
  }

  async listConversations(): Promise<AiConversation[]> {
    const res = await this.fetchApi.fetch(
      `${await this.baseUrl()}/conversations`,
    );
    return res.json();
  }

  async getConversation(id: string): Promise<AiConversation> {
    const res = await this.fetchApi.fetch(
      `${await this.baseUrl()}/conversations/${id}`,
    );
    return res.json();
  }

  async createConversation(
    request: CreateConversationRequest,
  ): Promise<AiConversation> {
    const res = await this.fetchApi.fetch(
      `${await this.baseUrl()}/conversations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
    );
    return res.json();
  }

  async sendMessage(
    conversationId: string,
    request: SendMessageRequest,
  ): Promise<AiAssistantMessage> {
    const res = await this.fetchApi.fetch(
      `${await this.baseUrl()}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
    );
    return res.json();
  }
}
```

- [ ] **Step 2: Create ChatPage component**

```tsx
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Page, Header, Content } from '@backstage/core-components';
import {
  Grid,
  TextField,
  IconButton,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
} from '@material-ui/core';
import SendIcon from '@material-ui/icons/Send';
import { aiAssistantApiRef } from '../api/AiAssistantClient';
import {
  AiConversation,
  AiAssistantMessage,
  AiAssistantMode,
} from '@backstage/plugin-ai-assistant-common';

export function ChatPage(): React.JSX.Element {
  const api = useApi(aiAssistantApiRef);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<
    AiConversation | undefined
  >();
  const [modes, setModes] = useState<AiAssistantMode[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listModes().then(setModes);
    api.listConversations().then(setConversations);
  }, [api]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !activeConversation) return;
    setLoading(true);
    const message = await api.sendMessage(activeConversation.id, {
      content: input,
    });
    setActiveConversation(prev =>
      prev
        ? {
            ...prev,
            messages: [
              ...prev.messages,
              {
                id: 'temp',
                role: 'user',
                content: input,
                timestamp: new Date().toISOString(),
              },
              message,
            ],
          }
        : prev,
    );
    setInput('');
    setLoading(false);
  }, [api, activeConversation, input]);

  const handleNewConversation = useCallback(
    async (modeId: string) => {
      const conv = await api.createConversation({ modeId });
      setConversations(prev => [conv, ...prev]);
      setActiveConversation(conv);
    },
    [api],
  );

  return (
    <Page themeId="tool">
      <Header
        title="AI Assistant"
        subtitle="Ask questions about your developer portal"
      />
      <Content>
        <Grid container spacing={2}>
          <Grid item xs={3}>
            <Paper style={{ padding: 16 }}>
              <Typography variant="h6">Conversations</Typography>
              <List>
                {conversations.map(c => (
                  <ListItem
                    key={c.id}
                    button
                    onClick={() =>
                      api.getConversation(c.id).then(setActiveConversation)
                    }
                  >
                    <ListItemText primary={c.title} secondary={c.modeId} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
          <Grid item xs={9}>
            <Paper style={{ padding: 16, minHeight: 400 }}>
              {activeConversation ? (
                <>
                  {activeConversation.messages.map(m => (
                    <div
                      key={m.id}
                      style={{
                        marginBottom: 8,
                        textAlign: m.role === 'user' ? 'right' : 'left',
                      }}
                    >
                      <Typography variant="body2" color="textSecondary">
                        {m.role}
                      </Typography>
                      <Typography variant="body1">{m.content}</Typography>
                    </div>
                  ))}
                  <div style={{ display: 'flex', marginTop: 16 }}>
                    <TextField
                      fullWidth
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSend()}
                      disabled={loading}
                      placeholder="Type a message..."
                    />
                    <IconButton onClick={handleSend} disabled={loading}>
                      <SendIcon />
                    </IconButton>
                  </div>
                </>
              ) : (
                <Typography>
                  Select a conversation or start a new one
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
}
```

- [ ] **Step 3: Create plugin.tsx, index.ts, commit**

```bash
git add plugins/ai-assistant/
git commit -s -m "feat(ai-assistant): add frontend plugin with chat UI, mode selector, and conversations"
```

---

### Task 13: AI Explorer Common Package

**Files:**

- Create: `plugins/ai-explorer-common/package.json`
- Create: `plugins/ai-explorer-common/src/index.ts`
- Create: `plugins/ai-explorer-common/src/types.ts`

**Interfaces:**

- Consumes: nothing
- Produces: `AiRule`, `AiSkill`, `AiPlugin`, `AiRuleQuery`, `AiSkillQuery`

- [ ] **Step 1: Create types.ts**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

/** A guardrail rule that governs AI behavior */
export interface AiRule {
  id: string;
  name: string;
  description: string;
  type: 'input-filter' | 'output-filter' | 'rate-limit' | 'model-restriction';
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A reusable prompt skill/template */
export interface AiSkill {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  variables: AiSkillVariable[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AiSkillVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

/** An MCP plugin/server registration */
export interface AiPlugin {
  id: string;
  name: string;
  description: string;
  serverUrl: string;
  transport: 'streamable-http' | 'sse' | 'stdio';
  tools: AiPluginTool[];
  enabled: boolean;
  createdAt: string;
}

export interface AiPluginTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AiRuleQuery {
  type?: AiRule['type'];
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

export interface AiSkillQuery {
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}
```

- [ ] **Step 2: Create index.ts and commit**

```ts
export {
  type AiRule,
  type AiSkill,
  type AiSkillVariable,
  type AiPlugin,
  type AiPluginTool,
  type AiRuleQuery,
  type AiSkillQuery,
} from './types';
```

```bash
git add plugins/ai-explorer-common/
git commit -s -m "feat(ai-explorer): add common package with rule, skill, and plugin types"
```

---

### Task 14: AI Explorer Backend

**Files:**

- Create: `plugins/ai-explorer-backend/package.json`
- Create: `plugins/ai-explorer-backend/src/index.ts`
- Create: `plugins/ai-explorer-backend/src/plugin.ts`
- Create: `plugins/ai-explorer-backend/src/service/router.ts`
- Create: `plugins/ai-explorer-backend/src/service/router.test.ts`
- Create: `plugins/ai-explorer-backend/src/service/RuleStore.ts`
- Create: `plugins/ai-explorer-backend/src/service/SkillStore.ts`
- Create: `plugins/ai-explorer-backend/src/service/PluginStore.ts`

**Interfaces:**

- Consumes: `coreServices.database`, `coreServices.httpRouter`, `coreServices.httpAuth`
- Produces: REST API at `/api/ai-explorer/` — CRUD for rules, skills, and plugins

- [ ] **Step 1: Create RuleStore**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { Knex } from 'knex';
import { AiRule, AiRuleQuery } from '@backstage/plugin-ai-explorer-common';
import { v4 as uuid } from 'uuid';

export class RuleStore {
  constructor(private readonly db: Knex) {}

  async create(
    rule: Omit<AiRule, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AiRule> {
    const id = uuid();
    const now = new Date().toISOString();
    await this.db('ai_explorer_rules').insert({
      id,
      name: rule.name,
      description: rule.description,
      type: rule.type,
      config: JSON.stringify(rule.config),
      enabled: rule.enabled,
      created_at: now,
      updated_at: now,
    });
    return { ...rule, id, createdAt: now, updatedAt: now };
  }

  async list(query: AiRuleQuery): Promise<AiRule[]> {
    let qb = this.db('ai_explorer_rules').select('*');
    if (query.type) qb = qb.where('type', query.type);
    if (query.enabled !== undefined) qb = qb.where('enabled', query.enabled);
    if (query.limit) qb = qb.limit(query.limit);
    if (query.offset) qb = qb.offset(query.offset);
    const rows = await qb;
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      type: r.type,
      config: JSON.parse(r.config),
      enabled: r.enabled,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async update(
    id: string,
    updates: Partial<Omit<AiRule, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<void> {
    const data: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined)
      data.description = updates.description;
    if (updates.config !== undefined)
      data.config = JSON.stringify(updates.config);
    if (updates.enabled !== undefined) data.enabled = updates.enabled;
    await this.db('ai_explorer_rules').where({ id }).update(data);
  }

  async delete(id: string): Promise<void> {
    await this.db('ai_explorer_rules').where({ id }).delete();
  }
}
```

- [ ] **Step 2: Create SkillStore (same pattern as RuleStore)**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { Knex } from 'knex';
import { AiSkill, AiSkillQuery } from '@backstage/plugin-ai-explorer-common';
import { v4 as uuid } from 'uuid';

export class SkillStore {
  constructor(private readonly db: Knex) {}

  async create(
    skill: Omit<AiSkill, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AiSkill> {
    const id = uuid();
    const now = new Date().toISOString();
    await this.db('ai_explorer_skills').insert({
      id,
      name: skill.name,
      description: skill.description,
      prompt_template: skill.promptTemplate,
      variables: JSON.stringify(skill.variables),
      tags: JSON.stringify(skill.tags),
      created_at: now,
      updated_at: now,
    });
    return { ...skill, id, createdAt: now, updatedAt: now };
  }

  async list(query: AiSkillQuery): Promise<AiSkill[]> {
    let qb = this.db('ai_explorer_skills').select('*');
    if (query.search) qb = qb.where('name', 'ilike', `%${query.search}%`);
    if (query.limit) qb = qb.limit(query.limit);
    if (query.offset) qb = qb.offset(query.offset);
    const rows = await qb;
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      promptTemplate: r.prompt_template,
      variables: JSON.parse(r.variables),
      tags: JSON.parse(r.tags),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async update(
    id: string,
    updates: Partial<Omit<AiSkill, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<void> {
    const data: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.promptTemplate !== undefined)
      data.prompt_template = updates.promptTemplate;
    if (updates.variables !== undefined)
      data.variables = JSON.stringify(updates.variables);
    if (updates.tags !== undefined) data.tags = JSON.stringify(updates.tags);
    await this.db('ai_explorer_skills').where({ id }).update(data);
  }

  async delete(id: string): Promise<void> {
    await this.db('ai_explorer_skills').where({ id }).delete();
  }
}
```

- [ ] **Step 3: Create router with CRUD endpoints for rules, skills, plugins**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { Router } from 'express';
import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
import { RuleStore } from './RuleStore';
import { SkillStore } from './SkillStore';
import { PluginStore } from './PluginStore';

export interface RouterOptions {
  ruleStore: RuleStore;
  skillStore: SkillStore;
  pluginStore: PluginStore;
  httpAuth: HttpAuthService;
  logger: LoggerService;
}

export function createRouter(options: RouterOptions): Router {
  const { ruleStore, skillStore, pluginStore, httpAuth } = options;
  const router = Router();

  // Rules CRUD
  router.get('/rules', async (req, res) => {
    const rules = await ruleStore.list({
      type: req.query.type as any,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    res.json(rules);
  });

  router.post('/rules', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const rule = await ruleStore.create(req.body);
    res.status(201).json(rule);
  });

  router.put('/rules/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    await ruleStore.update(req.params.id, req.body);
    res.status(204).end();
  });

  router.delete('/rules/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    await ruleStore.delete(req.params.id);
    res.status(204).end();
  });

  // Skills CRUD
  router.get('/skills', async (req, res) => {
    const skills = await skillStore.list({
      search: req.query.search as string,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    res.json(skills);
  });

  router.post('/skills', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const skill = await skillStore.create(req.body);
    res.status(201).json(skill);
  });

  router.put('/skills/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    await skillStore.update(req.params.id, req.body);
    res.status(204).end();
  });

  router.delete('/skills/:id', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    await skillStore.delete(req.params.id);
    res.status(204).end();
  });

  // Plugins CRUD
  router.get('/plugins', async (_req, res) => {
    const plugins = await pluginStore.list();
    res.json(plugins);
  });

  router.post('/plugins', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const plugin = await pluginStore.create(req.body);
    res.status(201).json(plugin);
  });

  return router;
}
```

- [ ] **Step 4: Create plugin.ts, index.ts, PluginStore, test, commit**

```bash
git add plugins/ai-explorer-backend/
git commit -s -m "feat(ai-explorer): add backend with rule, skill, and plugin stores"
```

---

### Task 15: AI Explorer Frontend

**Files:**

- Create: `plugins/ai-explorer/package.json`
- Create: `plugins/ai-explorer/src/index.ts`
- Create: `plugins/ai-explorer/src/alpha/plugin.tsx`
- Create: `plugins/ai-explorer/src/components/RulesPage.tsx`
- Create: `plugins/ai-explorer/src/components/SkillsPage.tsx`
- Create: `plugins/ai-explorer/src/components/PluginsPage.tsx`
- Create: `plugins/ai-explorer/src/api/AiExplorerClient.ts`

**Interfaces:**

- Consumes: AI Explorer Backend REST API
- Produces: Frontend plugin with rules, skills, and plugins management pages

- [ ] **Step 1: Create AiExplorerClient**

```ts
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import { createApiRef } from '@backstage/frontend-plugin-api';
import {
  AiRule,
  AiSkill,
  AiPlugin,
  AiRuleQuery,
  AiSkillQuery,
} from '@backstage/plugin-ai-explorer-common';

export const aiExplorerApiRef = createApiRef<AiExplorerApi>({
  id: 'plugin.ai-explorer.api',
});

export interface AiExplorerApi {
  listRules(query?: AiRuleQuery): Promise<AiRule[]>;
  createRule(
    rule: Omit<AiRule, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AiRule>;
  updateRule(id: string, updates: Partial<AiRule>): Promise<void>;
  deleteRule(id: string): Promise<void>;
  listSkills(query?: AiSkillQuery): Promise<AiSkill[]>;
  createSkill(
    skill: Omit<AiSkill, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AiSkill>;
  updateSkill(id: string, updates: Partial<AiSkill>): Promise<void>;
  deleteSkill(id: string): Promise<void>;
  listPlugins(): Promise<AiPlugin[]>;
  createPlugin(plugin: Omit<AiPlugin, 'id' | 'createdAt'>): Promise<AiPlugin>;
}

export class AiExplorerClient implements AiExplorerApi {
  private readonly fetchApi: { fetch: typeof fetch };
  private readonly discoveryApi: {
    getBaseUrl(pluginId: string): Promise<string>;
  };

  constructor(options: {
    fetchApi: { fetch: typeof fetch };
    discoveryApi: { getBaseUrl(pluginId: string): Promise<string> };
  }) {
    this.fetchApi = options.fetchApi;
    this.discoveryApi = options.discoveryApi;
  }

  private async baseUrl(): Promise<string> {
    return this.discoveryApi.getBaseUrl('ai-explorer');
  }

  async listRules(query?: AiRuleQuery): Promise<AiRule[]> {
    const params = new URLSearchParams();
    if (query?.type) params.set('type', query.type);
    const res = await this.fetchApi.fetch(
      `${await this.baseUrl()}/rules?${params}`,
    );
    return res.json();
  }

  async createRule(
    rule: Omit<AiRule, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AiRule> {
    const res = await this.fetchApi.fetch(`${await this.baseUrl()}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    return res.json();
  }

  async updateRule(id: string, updates: Partial<AiRule>): Promise<void> {
    await this.fetchApi.fetch(`${await this.baseUrl()}/rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  }

  async deleteRule(id: string): Promise<void> {
    await this.fetchApi.fetch(`${await this.baseUrl()}/rules/${id}`, {
      method: 'DELETE',
    });
  }

  async listSkills(query?: AiSkillQuery): Promise<AiSkill[]> {
    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    const res = await this.fetchApi.fetch(
      `${await this.baseUrl()}/skills?${params}`,
    );
    return res.json();
  }

  async createSkill(
    skill: Omit<AiSkill, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AiSkill> {
    const res = await this.fetchApi.fetch(`${await this.baseUrl()}/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skill),
    });
    return res.json();
  }

  async updateSkill(id: string, updates: Partial<AiSkill>): Promise<void> {
    await this.fetchApi.fetch(`${await this.baseUrl()}/skills/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  }

  async deleteSkill(id: string): Promise<void> {
    await this.fetchApi.fetch(`${await this.baseUrl()}/skills/${id}`, {
      method: 'DELETE',
    });
  }

  async listPlugins(): Promise<AiPlugin[]> {
    const res = await this.fetchApi.fetch(`${await this.baseUrl()}/plugins`);
    return res.json();
  }

  async createPlugin(
    plugin: Omit<AiPlugin, 'id' | 'createdAt'>,
  ): Promise<AiPlugin> {
    const res = await this.fetchApi.fetch(`${await this.baseUrl()}/plugins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plugin),
    });
    return res.json();
  }
}
```

- [ ] **Step 2: Create RulesPage component**

```tsx
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import {
  Table,
  TableColumn,
  Page,
  Header,
  Content,
} from '@backstage/core-components';
import { Button, Switch } from '@material-ui/core';
import { aiExplorerApiRef } from '../api/AiExplorerClient';
import { AiRule } from '@backstage/plugin-ai-explorer-common';

const columns: TableColumn<AiRule>[] = [
  { title: 'Name', field: 'name' },
  { title: 'Type', field: 'type' },
  { title: 'Description', field: 'description' },
  {
    title: 'Enabled',
    render: (row: AiRule) => <Switch checked={row.enabled} size="small" />,
  },
];

export function RulesPage(): React.JSX.Element {
  const api = useApi(aiExplorerApiRef);
  const [rules, setRules] = useState<AiRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listRules().then(r => {
      setRules(r);
      setLoading(false);
    });
  }, [api]);

  return (
    <Page themeId="tool">
      <Header title="AI Rules" subtitle="Manage AI guardrails and policies" />
      <Content>
        <Table
          title="Rules"
          columns={columns}
          data={rules}
          isLoading={loading}
          options={{ paging: true, pageSize: 20 }}
        />
      </Content>
    </Page>
  );
}
```

- [ ] **Step 3: Create plugin.tsx with new frontend system**

```tsx
/*
 * Copyright 2026 The Backstage Authors
 * ... (Apache 2.0 header)
 */

import {
  createFrontendPlugin,
  createPageExtension,
  createApiExtension,
  createApiFactory,
} from '@backstage/frontend-plugin-api';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { aiExplorerApiRef, AiExplorerClient } from '../api/AiExplorerClient';

const aiExplorerApiExtension = createApiExtension({
  factory: createApiFactory({
    api: aiExplorerApiRef,
    deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
    factory: ({ discoveryApi, fetchApi }) =>
      new AiExplorerClient({ discoveryApi, fetchApi }),
  }),
});

const rulesPage = createPageExtension({
  name: 'rules',
  defaultPath: '/ai-explorer/rules',
  loader: () => import('../components/RulesPage').then(m => <m.RulesPage />),
});

const skillsPage = createPageExtension({
  name: 'skills',
  defaultPath: '/ai-explorer/skills',
  loader: () => import('../components/SkillsPage').then(m => <m.SkillsPage />),
});

const pluginsPage = createPageExtension({
  name: 'plugins',
  defaultPath: '/ai-explorer/plugins',
  loader: () =>
    import('../components/PluginsPage').then(m => <m.PluginsPage />),
});

export default createFrontendPlugin({
  pluginId: 'ai-explorer',
  extensions: [aiExplorerApiExtension, rulesPage, skillsPage, pluginsPage],
});
```

- [ ] **Step 4: Create SkillsPage, PluginsPage, index.ts, commit**

```bash
git add plugins/ai-explorer/
git commit -s -m "feat(ai-explorer): add frontend plugin with rules, skills, and plugins management"
```

---

### Task 16: Backend and Frontend Wiring

**Files:**

- Modify: `packages/backend/src/index.ts`
- Modify: `packages/app/src/App.tsx`
- Modify: `packages/app/src/modules/appModuleNav.tsx`

**Interfaces:**

- Consumes: All AI Platform backend and frontend plugins
- Produces: Fully wired AI Platform in the dev app

- [ ] **Step 1: Update backend index**

Add after existing `backend.add(...)` lines:

```ts
// AI Gateway
backend.add(import('@backstage/plugin-ai-gateway-backend'));
backend.add(import('@backstage/plugin-ai-gateway-backend-module-anthropic'));
backend.add(import('@backstage/plugin-ai-gateway-backend-module-openai'));
backend.add(import('@backstage/plugin-ai-gateway-backend-module-ollama'));
backend.add(import('@backstage/plugin-ai-gateway-backend-module-bedrock'));

// AI Assistant
backend.add(import('@backstage/plugin-ai-assistant-backend'));

// AI Explorer
backend.add(import('@backstage/plugin-ai-explorer-backend'));
```

- [ ] **Step 2: Update frontend App.tsx**

Add to the `features` array in `createApp`:

```ts
import aiGatewayPlugin from '@backstage/plugin-ai-gateway/alpha';
import aiAssistantPlugin from '@backstage/plugin-ai-assistant/alpha';
import aiExplorerPlugin from '@backstage/plugin-ai-explorer/alpha';
```

```ts
features: [
  // ... existing plugins
  aiGatewayPlugin,
  aiAssistantPlugin,
  aiExplorerPlugin,
],
```

- [ ] **Step 3: Update sidebar navigation**

Add to `appModuleNav.tsx` nav items:

```ts
{ title: 'AI Assistant', path: '/ai-assistant', icon: ChatIcon },
{ title: 'AI Gateway', path: '/ai-gateway', icon: CloudIcon },
{ title: 'AI Explorer', path: '/ai-explorer/rules', icon: ExtensionIcon },
```

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/index.ts packages/app/src/App.tsx packages/app/src/modules/appModuleNav.tsx
git commit -s -m "feat: wire AI Platform plugins into backend and frontend"
```

---

### Task 17: Integration Verification

**Files:**

- No new files — verification only

**Interfaces:**

- Consumes: All AI Platform plugins
- Produces: Verified working AI Platform

- [ ] **Step 1: Type check**

Run: `yarn tsc 2>&1 | tail -5`
Expected: No errors

- [ ] **Step 2: Run AI Gateway backend tests**

Run: `CI=1 yarn test plugins/ai-gateway-backend 2>&1 | tail -20`
Expected: Tests pass

- [ ] **Step 3: Run Anthropic module tests**

Run: `CI=1 yarn test plugins/ai-gateway-backend-module-anthropic 2>&1 | tail -10`
Expected: Tests pass

- [ ] **Step 4: Run AI Assistant backend tests**

Run: `CI=1 yarn test plugins/ai-assistant-backend 2>&1 | tail -20`
Expected: Tests pass

- [ ] **Step 5: Run AI Explorer backend tests**

Run: `CI=1 yarn test plugins/ai-explorer-backend 2>&1 | tail -20`
Expected: Tests pass

- [ ] **Step 6: Verify dev server starts**

Run: `yarn start 2>&1 | head -30`
Expected: Backend and frontend start without import errors

---

## Post-AI Platform: What's Ready

| Component               | Status                                                 |
| ----------------------- | ------------------------------------------------------ |
| AI Gateway backend      | ✅ Multi-provider proxy with usage tracking            |
| AI Gateway frontend     | ✅ Provider management, model browser, usage dashboard |
| Anthropic provider      | ✅ Claude Sonnet 4, Opus 4, Haiku 3.5                  |
| OpenAI provider         | ✅ GPT-4o, GPT-4o-mini                                 |
| Ollama provider         | ✅ Self-hosted model support                           |
| AWS Bedrock provider    | ✅ Bedrock-hosted models                               |
| AI Assistant backend    | ✅ Conversations, RAG pipeline, modes                  |
| AI Assistant frontend   | ✅ Chat UI, mode selector, conversation sidebar        |
| AI Explorer backend     | ✅ Rules, skills, plugins CRUD                         |
| AI Explorer frontend    | ✅ Management UI for rules, skills, plugins            |
| MCP Actions integration | ✅ Existing MCP Actions Backend used by Assistant      |

**Next:** Sub-project 5: Intelligence & Automation (DevEx Metrics, Fleetshift, Template Editor)
