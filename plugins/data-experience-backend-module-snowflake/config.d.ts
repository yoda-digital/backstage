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
    snowflake?: {
      /**
       * The Snowflake account identifier, e.g. `xy12345.eu-west-1`.
       * @visibility backend
       */
      account: string;

      /**
       * The virtual warehouse to run queries against.
       * @visibility backend
       */
      warehouse: string;

      /**
       * The database to discover datasets in.
       * @visibility backend
       */
      database: string;

      /**
       * The schema to discover datasets in. When omitted, all schemas in the
       * database are discovered.
       * @visibility backend
       */
      schema?: string;

      credentials?: {
        /**
         * The username to authenticate with.
         * @visibility secret
         */
        username: string;

        /**
         * The password to authenticate with. Prefer `privateKey` where
         * possible.
         * @visibility secret
         */
        password?: string;

        /**
         * A PEM-encoded private key, used for key-pair authentication.
         * @visibility secret
         */
        privateKey?: string;
      };
    };
  };
}
