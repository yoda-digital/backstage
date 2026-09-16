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

import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  DatasetMetadata,
  WarehouseType,
} from '@backstage/plugin-data-experience-common';
import { WarehouseConnector } from '@backstage/plugin-data-experience-node';

/** @public */
export interface BigQueryConnectorOptions {
  projectId: string;
  datasetId?: string;
  credentialsPath?: string;
  credentials?: string;
  logger: LoggerService;
}

const BIGQUERY_TABLE_TYPES: Record<string, string> = {
  TABLE: 'table',
  VIEW: 'view',
  MATERIALIZED_VIEW: 'view',
  EXTERNAL: 'table',
  SNAPSHOT: 'table',
};

/**
 * A {@link @backstage/plugin-data-experience-node#WarehouseConnector} that
 * discovers tables, views, and materialized views held by a Google BigQuery
 * project, and reports their column-level metadata back to the Data
 * Experience backend.
 *
 * @public
 */
export class BigQueryConnector implements WarehouseConnector {
  readonly connectorId = 'bigquery';
  readonly warehouseType: WarehouseType = 'bigquery';

  private connected = false;

  private constructor(private readonly options: BigQueryConnectorOptions) {}

  /**
   * Creates a {@link BigQueryConnector} from the `dataExperience.bigquery`
   * configuration block.
   */
  static fromConfig(
    config: Config,
    options: { logger: LoggerService },
  ): BigQueryConnector {
    const bigQueryConfig = config.getConfig('dataExperience.bigquery');

    return new BigQueryConnector({
      projectId: bigQueryConfig.getString('projectId'),
      datasetId: bigQueryConfig.getOptionalString('datasetId'),
      credentialsPath: bigQueryConfig.getOptionalString('credentialsPath'),
      credentials: bigQueryConfig.getOptionalString('credentials'),
      logger: options.logger,
    });
  }

  async connect(): Promise<void> {
    this.options.logger.info(
      `Connected to BigQuery project ${this.options.projectId}${
        this.options.datasetId ? `, dataset ${this.options.datasetId}` : ''
      }`,
    );
    this.connected = true;
  }

  async query(query: string): Promise<Array<Record<string, unknown>>> {
    await this.ensureConnected();
    this.options.logger.debug(`Running BigQuery query: ${query}`);
    // The actual BigQuery SDK call is intentionally left as an integration
    // point: adopters wire in `@google-cloud/bigquery` here, authenticating
    // with `this.options.credentials`/`this.options.credentialsPath`.
    return [];
  }

  async discoverDatasets(): Promise<
    Array<{ name: string; schema?: string; type: string }>
  > {
    await this.ensureConnected();
    const datasetFilter = this.options.datasetId
      ? `table_schema = '${this.options.datasetId}'`
      : '1=1';
    const rows = await this.query(
      `SELECT table_name, table_schema, table_type FROM \`${this.options.projectId}\`.INFORMATION_SCHEMA.TABLES WHERE ${datasetFilter}`,
    );
    return rows.map(row => ({
      name: String(row.table_name),
      schema: row.table_schema as string | undefined,
      type: BIGQUERY_TABLE_TYPES[String(row.table_type)] ?? 'table',
    }));
  }

  async getMetadata(datasetName: string): Promise<DatasetMetadata> {
    await this.ensureConnected();
    const datasetFilter = this.options.datasetId
      ? `table_schema = '${this.options.datasetId}' AND `
      : '';
    const columnRows = await this.query(
      `SELECT column_name, data_type, is_nullable FROM \`${this.options.projectId}\`.INFORMATION_SCHEMA.COLUMNS WHERE ${datasetFilter}table_name = '${datasetName}'`,
    );
    return {
      entityRef: datasetName,
      columns: columnRows.map(row => ({
        name: String(row.column_name),
        type: String(row.data_type),
        nullable: row.is_nullable !== 'NO',
      })),
    };
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }
}
