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
  catalogBuilder?: {
    providers?: {
      /**
       * Configuration for browsing and ingesting repositories from a GitLab
       * instance. Credentials are read from the matching entry under
       * `integrations.gitlab`.
       */
      gitlab?: {
        /**
         * The host of the GitLab instance to browse, e.g. `gitlab.com` or a
         * self-managed host such as `git.example.com`. Must match the `host`
         * of a configured `integrations.gitlab` entry.
         * @visibility backend
         */
        host: string;
      };
      /**
       * Configuration for browsing and ingesting repositories from Azure
       * DevOps. Credentials are read from the matching entry under
       * `integrations.azure`.
       */
      azure?: {
        /**
         * The Azure DevOps organization to browse for projects and
         * repositories.
         * @visibility backend
         */
        organization: string;
        /**
         * The host of the Azure DevOps instance. Defaults to
         * `dev.azure.com`. Must match the `host` of a configured
         * `integrations.azure` entry.
         * @visibility backend
         */
        host?: string;
      };
    };
  };
}
