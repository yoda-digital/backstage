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

import { LoggerService } from '@backstage/backend-plugin-api';
import { AiKnowledgeSource } from '@backstage/plugin-ai-assistant-node';
import {
  AiAssistantMode,
  KnowledgeChunk,
} from '@backstage/plugin-ai-assistant-common';
import { KnowledgeSourceManager } from './KnowledgeSourceManager';

const MAX_RESULTS_PER_SOURCE = 5;
const MIN_SCORE = 0.3;
const MAX_CONTEXT_CHUNKS = 10;

/**
 * Retrieves and assembles context from registered knowledge sources for a
 * given assistant mode (RAG: retrieval-augmented generation).
 *
 * @internal
 */
export class RagPipeline {
  constructor(
    private readonly knowledgeSources: KnowledgeSourceManager,
    private readonly logger: LoggerService,
  ) {}

  async retrieve(
    query: string,
    mode: AiAssistantMode,
  ): Promise<KnowledgeChunk[]> {
    const chunks: KnowledgeChunk[] = [];
    for (const sourceId of mode.knowledgeSources) {
      const source: AiKnowledgeSource | undefined =
        this.knowledgeSources.getSource(sourceId);
      if (!source) {
        this.logger.warn(`Knowledge source '${sourceId}' not found, skipping`);
        continue;
      }
      const results = await source.search(query, {
        maxResults: MAX_RESULTS_PER_SOURCE,
        minScore: MIN_SCORE,
      });
      chunks.push(...results);
    }
    chunks.sort((a, b) => b.score - a.score);
    return chunks.slice(0, MAX_CONTEXT_CHUNKS);
  }

  buildContext(chunks: KnowledgeChunk[]): string {
    if (chunks.length === 0) return '';
    const contextParts = chunks.map(
      (c, i) => `[Source ${i + 1}: ${c.sourceId}]\n${c.content}`,
    );
    return `\n\nRelevant context:\n${contextParts.join('\n\n')}`;
  }
}
