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
  /**
   * Soundcheck plugin configuration.
   */
  soundcheck?: {
    /**
     * Default schedule for fact collection.
     */
    schedule?: {
      /**
       * How often the fact collectors should run.
       * @visibility backend
       */
      frequency?: { minutes: number };
      /**
       * The maximum duration a single fact collection run may take.
       * @visibility backend
       */
      timeout?: { minutes: number };
    };
    /**
     * Path to a YAML file with check and track definitions.
     * @visibility backend
     */
    checksFile?: string;
    /**
     * Configuration for check result history retention.
     */
    results?: {
      history?: {
        /**
         * Whether the scheduled history cleanup task is enabled.
         * @visibility backend
         */
        enable?: boolean;
        /**
         * How many days to keep check results before they are deleted by
         * the cleanup task. Defaults to 120.
         * @visibility backend
         */
        retentionTimeInDays?: number;
        /**
         * Cron expression controlling how often the cleanup task runs.
         * Defaults to daily at midnight.
         * @visibility backend
         */
        cleanupFrequencyCron?: string;
      };
    };
  };
}
