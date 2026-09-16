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
import {
  AiKnowledgeSource,
  AiKnowledgeSourceExtensionPoint,
} from '@backstage/plugin-ai-assistant-node';

/**
 * Tracks registered knowledge source implementations, keyed by source id.
 *
 * @internal
 */
export class KnowledgeSourceManager implements AiKnowledgeSourceExtensionPoint {
  private readonly sources = new Map<string, AiKnowledgeSource>();

  constructor(private readonly logger?: LoggerService) {}

  registerSource(source: AiKnowledgeSource): void {
    if (this.sources.has(source.sourceId)) {
      throw new Error(
        `Knowledge source '${source.sourceId}' already registered`,
      );
    }
    this.sources.set(source.sourceId, source);
    this.logger?.info(`Registered knowledge source: ${source.sourceId}`);
  }

  getSources(): Map<string, AiKnowledgeSource> {
    return this.sources;
  }

  getSource(sourceId: string): AiKnowledgeSource | undefined {
    return this.sources.get(sourceId);
  }
}
