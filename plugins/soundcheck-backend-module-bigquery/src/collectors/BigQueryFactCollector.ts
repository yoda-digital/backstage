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
import { SoundcheckFactCollector } from '@backstage/plugin-soundcheck-node';
import { SoundcheckFact } from '@backstage/plugin-soundcheck-common';

/**
 * Options used to create a {@link BigQueryFactCollector}.
 * @internal
 */
export interface BigQueryFactCollectorOptions {
  projectId: string;
  credentials: string;
  logger: LoggerService;
}

interface BigQueryTable {
  numRows?: string;
  lastModifiedTime?: string;
  schema?: { fields?: unknown[] };
}

/**
 * Collects dataset row counts, last modified time, and schema compliance
 * from BigQuery for the dataset associated with an entity's component.
 * @internal
 */
export class BigQueryFactCollector implements SoundcheckFactCollector {
  readonly factRef = 'soundcheck:bigquery/dataset-metrics';
  readonly description =
    'Collects dataset row counts, last modified time, and schema compliance from BigQuery';

  private constructor(private readonly options: BigQueryFactCollectorOptions) {}

  static create(options: BigQueryFactCollectorOptions): BigQueryFactCollector {
    return new BigQueryFactCollector(options);
  }

  async collect(
    entityRef: string,
  ): Promise<Omit<SoundcheckFact, 'factRef' | 'entityRef' | 'collectedAt'>> {
    const { projectId, credentials, logger } = this.options;
    const datasetId = entityRef.split('/').pop() ?? entityRef;

    try {
      const url = new URL(
        `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets/${datasetId}/tables`,
      );

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${credentials}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return {
          data: {
            available: false,
            reason: `BigQuery API returned ${response.status}`,
          },
        };
      }

      const body = (await response.json()) as { tables?: BigQueryTable[] };
      const tables = body.tables ?? [];

      const rowCount = tables.reduce(
        (sum, table) => sum + Number(table.numRows ?? 0),
        0,
      );
      const lastModifiedTimes = tables
        .map(table => Number(table.lastModifiedTime ?? 0))
        .filter(time => time > 0);
      const lastModified = lastModifiedTimes.length
        ? new Date(Math.max(...lastModifiedTimes)).toISOString()
        : undefined;
      const tablesWithSchema = tables.filter(
        table => (table.schema?.fields?.length ?? 0) > 0,
      ).length;
      const schemaComplianceRate = tables.length
        ? tablesWithSchema / tables.length
        : 1;

      return {
        data: {
          available: true,
          rowCount,
          lastModified,
          schemaComplianceRate,
        },
      };
    } catch (error) {
      logger.warn(
        `Failed to collect BigQuery facts for ${entityRef}: ${error}`,
      );
      return {
        data: {
          available: false,
          reason: 'Failed to reach the BigQuery API',
        },
      };
    }
  }
}
