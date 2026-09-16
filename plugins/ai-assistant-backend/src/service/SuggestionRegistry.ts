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
  AiSuggestionProvider,
  AiSuggestionsExtensionPoint,
} from '@backstage/plugin-ai-assistant-node';
import { AiSuggestion } from '@backstage/plugin-ai-assistant-common';

/**
 * Tracks AiKA suggestion chips registered by other plugins, keyed by the
 * route pattern they apply to.
 *
 * @internal
 */
export class SuggestionRegistry implements AiSuggestionsExtensionPoint {
  private readonly providers: AiSuggestionProvider[] = [];

  constructor(private readonly logger?: LoggerService) {}

  registerSuggestions(provider: AiSuggestionProvider): void {
    this.providers.push(provider);
    this.logger?.info(
      `Registered AiKA suggestions for route pattern: ${provider.routePattern}`,
    );
  }

  /** Returns the suggestions registered for route patterns that match the given route. */
  forRoute(route: string): AiSuggestion[] {
    return this.providers
      .filter(
        provider =>
          provider.routePattern === '*' ||
          route.includes(provider.routePattern),
      )
      .flatMap(provider => provider.suggestions);
  }
}
