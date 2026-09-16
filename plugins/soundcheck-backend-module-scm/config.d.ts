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
      scm?: {
        /**
         * Repository-relative file paths whose existence is checked and
         * reported as part of the source content analysis fact, in
         * addition to the standard set (README, CODEOWNERS, CI config,
         * catalog-info.yaml, CHANGELOG, LICENSE).
         * @visibility backend
         */
        additionalFiles?: string[];
        /**
         * Content checks to run against specific files, matching a regular
         * expression against the file's raw contents.
         * @visibility backend
         */
        patterns?: Array<{
          /**
           * Name for this check, used as the key in the fact data.
           * @visibility backend
           */
          name: string;
          /**
           * Repository-relative path of the file to check.
           * @visibility backend
           */
          path: string;
          /**
           * Regular expression (as a string) that must match the file
           * contents for the check to pass.
           * @visibility backend
           */
          regex: string;
        }>;
      };
    };
  };
}
