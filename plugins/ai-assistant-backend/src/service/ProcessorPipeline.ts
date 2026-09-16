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
import { AiChatMessage } from '@backstage/plugin-ai-gateway-common';
import {
  AiMode,
  AiProcessor,
  AiProcessorType,
  PageContext,
} from '@backstage/plugin-ai-assistant-common';
import { AiGatewayClient } from './AiGatewayClient';

/** Maximum number of revise-and-reverify cycles the verification processor will run. */
const MAX_VERIFICATION_RETRIES = 2;

/** Input to a single {@link ProcessorPipeline.run} invocation. */
export interface ProcessorRunRequest {
  mode: AiMode;
  pageContext?: PageContext;
  /** Prior messages in the conversation, oldest first. */
  history: AiChatMessage[];
  userMessage: string;
  /** Model used when the mode and a processor don't specify their own. */
  defaultModel: string;
}

/** Output of a {@link ProcessorPipeline.run} invocation. */
export interface ProcessorRunResult {
  content: string;
  classification?: string;
  plan?: string;
  confidence?: 'low' | 'medium' | 'high';
}

function indexProcessors(
  processors: AiProcessor[],
): Map<AiProcessorType, AiProcessor> {
  const byType = new Map<AiProcessorType, AiProcessor>();
  for (const processor of processors) {
    byType.set(processor.type, processor);
  }
  return byType;
}

/**
 * Orchestrates a mode's processor pipeline around a single AI Gateway call:
 *
 * 1. `context-management` — trims conversation history to a manageable size
 * 2. `classification` — categorizes the request (how-to, operational, lookup)
 * 3. `planning` — drafts a short investigation plan
 * 4. the main AI Gateway call, using the mode's instructions and the outputs above
 * 5. `answer-formatting` — restructures the response for clarity
 * 6. `verification` — checks the response against the request, retrying if needed
 * 7. `confidence-scoring` — rates the final response low/medium/high
 *
 * Each processor is independently enabled/disabled via the mode's
 * `processors` config, and may use its own model for cost optimization.
 *
 * @internal
 */
export class ProcessorPipeline {
  private constructor(
    private readonly gatewayClient: AiGatewayClient,
    private readonly logger: LoggerService,
  ) {}

  static create(options: {
    gatewayClient: AiGatewayClient;
    logger: LoggerService;
  }): ProcessorPipeline {
    return new ProcessorPipeline(options.gatewayClient, options.logger);
  }

  async run(request: ProcessorRunRequest): Promise<ProcessorRunResult> {
    const processors = indexProcessors(request.mode.processors);

    let history = request.history;
    if (processors.get('context-management')?.enabled) {
      history = this.manageContext(history, request.mode.maxSteps);
    }

    let classification: string | undefined;
    if (processors.get('classification')?.enabled) {
      classification = await this.classify(request, processors);
    }

    let plan: string | undefined;
    if (processors.get('planning')?.enabled) {
      plan = await this.plan(request, classification, processors);
    }

    const systemPrompt = this.buildSystemPrompt(request, classification, plan);
    let content = await this.callModel(request, systemPrompt, history);

    if (processors.get('answer-formatting')?.enabled) {
      content = await this.formatAnswer(request, content, processors);
    }

    if (processors.get('verification')?.enabled) {
      content = await this.verify(
        request,
        systemPrompt,
        history,
        content,
        processors,
      );
    }

    let confidence: 'low' | 'medium' | 'high' = 'medium';
    if (processors.get('confidence-scoring')?.enabled) {
      confidence = await this.scoreConfidence(request, content, processors);
    }

    return { content, classification, plan, confidence };
  }

  private modelFor(
    request: ProcessorRunRequest,
    processors: Map<AiProcessorType, AiProcessor>,
    type: AiProcessorType,
  ): string {
    return (
      processors.get(type)?.modelId ??
      request.mode.modelOverride ??
      request.defaultModel
    );
  }

  private async chat(
    modelId: string,
    system: string,
    messages: AiChatMessage[],
    temperature?: number,
  ): Promise<string> {
    const response = await this.gatewayClient.chat({
      modelId,
      system,
      messages,
      maxTokens: 1024,
      temperature,
      stream: false,
    });
    return response.content;
  }

  private manageContext(
    history: AiChatMessage[],
    maxSteps: number | undefined,
  ): AiChatMessage[] {
    const limit = Math.max(2, (maxSteps ?? 10) * 2);
    return history.length > limit ? history.slice(-limit) : history;
  }

  private async classify(
    request: ProcessorRunRequest,
    processors: Map<AiProcessorType, AiProcessor>,
  ): Promise<string> {
    const modelId = this.modelFor(request, processors, 'classification');
    const verdict = await this.chat(
      modelId,
      'You are a request classifier for a developer portal assistant. ' +
        'Categorize the user request as exactly one of: how-to, operational, lookup. ' +
        'Respond with only the category.',
      [{ role: 'user', content: request.userMessage }],
    );
    return verdict.trim().toLowerCase();
  }

  private async plan(
    request: ProcessorRunRequest,
    classification: string | undefined,
    processors: Map<AiProcessorType, AiProcessor>,
  ): Promise<string> {
    const modelId = this.modelFor(request, processors, 'planning');
    const category = classification ? `${classification} ` : '';
    return this.chat(
      modelId,
      'You are a planning assistant. Draft a brief, numbered investigation ' +
        'plan (2-4 steps) describing how to gather information before answering. ' +
        'Do not answer the request itself.',
      [
        {
          role: 'user',
          content: `Plan how to handle this ${category}request: ${request.userMessage}`,
        },
      ],
    );
  }

  private buildSystemPrompt(
    request: ProcessorRunRequest,
    classification: string | undefined,
    plan: string | undefined,
  ): string {
    const parts = [request.mode.instructions];
    const { pageContext } = request;
    if (pageContext) {
      const details = [`route=${pageContext.route}`];
      if (pageContext.entityRef)
        details.push(`entity=${pageContext.entityRef}`);
      if (pageContext.techDocsPath)
        details.push(`techDocsPath=${pageContext.techDocsPath}`);
      parts.push(
        `Current page context: ${details.join(', ')}. Page title: "${
          pageContext.pageTitle
        }".`,
      );
    }
    if (classification) {
      parts.push(`Request classification: ${classification}.`);
    }
    if (plan) {
      parts.push(`Investigation plan:\n${plan}`);
    }
    return parts.filter(Boolean).join('\n\n');
  }

  private async callModel(
    request: ProcessorRunRequest,
    systemPrompt: string,
    history: AiChatMessage[],
  ): Promise<string> {
    const modelId = request.mode.modelOverride ?? request.defaultModel;
    return this.chat(
      modelId,
      systemPrompt,
      [...history, { role: 'user', content: request.userMessage }],
      request.mode.temperature,
    );
  }

  private async formatAnswer(
    request: ProcessorRunRequest,
    content: string,
    processors: Map<AiProcessorType, AiProcessor>,
  ): Promise<string> {
    const modelId = this.modelFor(request, processors, 'answer-formatting');
    return this.chat(
      modelId,
      'You are an editor. Restructure the given answer for clarity using ' +
        'short paragraphs and bullet points where helpful. Preserve all ' +
        'factual content and do not add or remove information.',
      [{ role: 'user', content: `Answer to restructure:\n${content}` }],
    );
  }

  private async verify(
    request: ProcessorRunRequest,
    systemPrompt: string,
    history: AiChatMessage[],
    content: string,
    processors: Map<AiProcessorType, AiProcessor>,
  ): Promise<string> {
    const modelId = this.modelFor(request, processors, 'verification');
    let current = content;

    for (let attempt = 0; attempt < MAX_VERIFICATION_RETRIES; attempt++) {
      const verdict = await this.chat(
        modelId,
        'You are a quality reviewer. Reply with exactly "OK" if the answer ' +
          'fully and accurately addresses the request. Otherwise, reply with ' +
          'a short list of what is missing or incorrect.',
        [
          {
            role: 'user',
            content: `Request: ${request.userMessage}\n\nAnswer:\n${current}`,
          },
        ],
      );

      if (verdict.trim().toUpperCase().startsWith('OK')) {
        return current;
      }

      this.logger.info(
        `Verification requested a revision (attempt ${
          attempt + 1
        }): ${verdict}`,
      );
      current = await this.chat(
        request.mode.modelOverride ?? request.defaultModel,
        systemPrompt,
        [
          ...history,
          { role: 'user', content: request.userMessage },
          { role: 'assistant', content: current },
          {
            role: 'user',
            content: `Please revise your answer to address: ${verdict}`,
          },
        ],
        request.mode.temperature,
      );
    }

    return current;
  }

  private async scoreConfidence(
    request: ProcessorRunRequest,
    content: string,
    processors: Map<AiProcessorType, AiProcessor>,
  ): Promise<'low' | 'medium' | 'high'> {
    const modelId = this.modelFor(request, processors, 'confidence-scoring');
    const verdict = await this.chat(
      modelId,
      'Rate your confidence in the accuracy and completeness of the given ' +
        'answer as exactly one word: low, medium, or high.',
      [
        {
          role: 'user',
          content: `Request: ${request.userMessage}\n\nAnswer:\n${content}`,
        },
      ],
    );
    const normalized = verdict.trim().toLowerCase();
    if (normalized.includes('high')) return 'high';
    if (normalized.includes('low')) return 'low';
    return 'medium';
  }
}
