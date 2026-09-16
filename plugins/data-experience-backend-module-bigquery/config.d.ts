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
    bigquery?: {
      /**
       * The GCP project id to discover datasets in.
       * @visibility backend
       */
      projectId: string;

      /**
       * A specific BigQuery dataset id to restrict discovery to. When
       * omitted, all datasets in the project are discovered.
       * @visibility backend
       */
      datasetId?: string;

      /**
       * The path to a GCP service account key file used to authenticate.
       * When omitted, application default credentials are used.
       * @visibility secret
       */
      credentialsPath?: string;

      /**
       * A GCP service account key, inlined as JSON. Takes precedence over
       * `credentialsPath` when both are set.
       * @visibility secret
       */
      credentials?: string;
    };
  };
}
