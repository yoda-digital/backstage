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

import { Knex } from 'knex';
import {
  AiUsageRecord,
  AiUsageQuery,
  AiUsageSummary,
} from '@backstage/plugin-ai-gateway-common';

interface UsageRow {
  id: string;
  provider_id: string;
  model_id: string;
  user_entity_ref: string;
  prompt_tokens: number;
  completion_tokens: number;
  created_at: string;
}

/**
 * Records and queries AI Gateway usage events.
 *
 * @internal
 */
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
    let qb = this.db<UsageRow>('ai_gateway_usage').select('*');
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
    return rows.map(r => this.rowToRecord(r));
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

  private rowToRecord(row: UsageRow): AiUsageRecord {
    return {
      id: row.id,
      providerId: row.provider_id,
      modelId: row.model_id,
      userEntityRef: row.user_entity_ref,
      promptTokens: row.prompt_tokens,
      completionTokens: row.completion_tokens,
      timestamp: row.created_at,
    };
  }
}
