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
  dataExperience?: {
    dbt?: {
      /**
       * The path to a local dbt `manifest.json` artifact, as produced by
       * `dbt compile` or `dbt run`. Either this or `cloud` must be set.
       * @visibility backend
       */
      manifestPath?: string;

      /**
       * Options for fetching the manifest from dbt Cloud instead of a local
       * file. Either this or `manifestPath` must be set.
       */
      cloud?: {
        /**
         * The dbt Cloud API token used to authenticate.
         * @visibility secret
         */
        apiToken: string;

        /**
         * The dbt Cloud account id that owns the job.
         * @visibility backend
         */
        accountId: string;

        /**
         * The dbt Cloud job id to fetch the latest manifest artifact from.
         * @visibility backend
         */
        jobId: string;

        /**
         * The dbt Cloud API base URL. Defaults to `https://cloud.getdbt.com`.
         * @visibility backend
         */
        baseUrl?: string;
      };
    };
  };
}
