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

export interface Config {
  soundcheck?: {
    collectors?: {
      http?: {
        /**
         * A list of generic HTTP endpoints to collect facts from. Each
         * entry becomes its own fact collector.
         * @visibility backend
         */
        endpoints?: Array<{
          /**
           * The fact ref this endpoint's response is published under.
           * @visibility backend
           */
          factRef: string;
          /**
           * The URL to fetch. May contain a `{entityRef}` placeholder that
           * is substituted with the URL-encoded entity ref being checked.
           * @visibility backend
           */
          url: string;
          /**
           * HTTP method to use. Defaults to `GET`.
           * @visibility backend
           */
          method?: string;
          /**
           * Headers to send with the request, e.g. an Authorization header.
           * @visibility secret
           */
          headers?: Record<string, string>;
          /**
           * A dot-delimited path into the JSON response body to extract as
           * the fact data. When omitted, the whole response body is used.
           * @visibility backend
           */
          jsonPath?: string;
        }>;
      };
    };
  };
}
