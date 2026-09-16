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

import { AuthService, DiscoveryService } from '@backstage/backend-plugin-api';
import { ResponseError } from '@backstage/errors';
import {
  AiChatRequest,
  AiChatResponse,
} from '@backstage/plugin-ai-gateway-common';

/**
 * Service-to-service client for the AI Gateway backend, used to send
 * assistant chat completions through the shared provider/usage layer.
 *
 * @internal
 */
export class AiGatewayClient {
  private constructor(
    private readonly discovery: DiscoveryService,
    private readonly auth: AuthService,
  ) {}

  static create(options: {
    discovery: DiscoveryService;
    auth: AuthService;
  }): AiGatewayClient {
    return new AiGatewayClient(options.discovery, options.auth);
  }

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const baseUrl = await this.discovery.getBaseUrl('ai-gateway');
    const { token } = await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: 'ai-gateway',
    });
    const res = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      throw await ResponseError.fromResponse(res);
    }
    return (await res.json()) as AiChatResponse;
  }
}
