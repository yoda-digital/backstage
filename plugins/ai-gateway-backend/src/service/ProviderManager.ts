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
  AiProvider,
  AiProviderExtensionPoint,
} from '@backstage/plugin-ai-gateway-node';
import { AiModel, AiProviderInfo } from '@backstage/plugin-ai-gateway-common';

/**
 * Tracks registered AI provider implementations and resolves the right
 * provider for a given model or provider id.
 *
 * @internal
 */
export class ProviderManager implements AiProviderExtensionPoint {
  private readonly providers = new Map<string, AiProvider>();

  constructor(private readonly logger?: LoggerService) {}

  registerProvider(provider: AiProvider): void {
    if (this.providers.has(provider.providerId)) {
      throw new Error(
        `AI provider '${provider.providerId}' is already registered`,
      );
    }
    this.providers.set(provider.providerId, provider);
    this.logger?.info(`Registered AI provider: ${provider.providerId}`);
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

  /**
   * Returns the first registered provider, used as a fallback when a chat
   * request does not specify a model id.
   */
  getDefaultProvider(): AiProvider {
    const [provider] = this.providers.values();
    if (!provider) {
      throw new Error('No AI providers are registered');
    }
    return provider;
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
