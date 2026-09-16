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

import { LoggerService, SchedulerService } from '@backstage/backend-plugin-api';
import { SoundcheckStore } from '../database/SoundcheckStore';

/** @internal */
export interface HistoryCleanupOptions {
  store: SoundcheckStore;
  scheduler: SchedulerService;
  logger: LoggerService;
  retentionTimeInDays: number;
  cleanupFrequencyCron: string;
}

/**
 * Registers a scheduled task that deletes Soundcheck check results older
 * than the configured retention period.
 *
 * @internal
 */
export async function scheduleHistoryCleanup(
  options: HistoryCleanupOptions,
): Promise<void> {
  const {
    store,
    scheduler,
    logger,
    retentionTimeInDays,
    cleanupFrequencyCron,
  } = options;

  await scheduler.scheduleTask({
    id: 'soundcheck-results-history-cleanup',
    frequency: { cron: cleanupFrequencyCron },
    timeout: { minutes: 10 },
    fn: async () => {
      const deleted = await store.deleteExpiredCheckResults(
        retentionTimeInDays,
      );
      if (deleted > 0) {
        logger.info(
          `Deleted ${deleted} Soundcheck check result(s) older than ${retentionTimeInDays} days`,
        );
      }
    },
  });
}
