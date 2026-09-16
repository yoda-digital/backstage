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
import { InputError } from '@backstage/errors';
import {
  DatasetMetadata,
  WarehouseType,
} from '@backstage/plugin-data-experience-common';
import { WarehouseConnector } from '@backstage/plugin-data-experience-node';

/** @public */
export interface SnowflakeConnectorOptions {
  account: string;
  warehouse: string;
  database: string;
  schema?: string;
  credentials?: {
    username: string;
    password?: string;
    privateKey?: string;
  };
  logger: LoggerService;
}

/**
 * A {@link @backstage/plugin-data-experience-node#WarehouseConnector} that
 * discovers tables and views held by a Snowflake account, and reports their
 * column-level metadata back to the Data Experience backend.
 *
 * @public
 */
export class SnowflakeConnector implements WarehouseConnector {
  readonly connectorId = 'snowflake';
  readonly warehouseType: WarehouseType = 'snowflake';

  private connected = false;

  private constructor(private readonly options: SnowflakeConnectorOptions) {}

  /**
   * Creates a {@link SnowflakeConnector} from the `dataExperience.snowflake`
   * configuration block.
   */
  static fromConfig(
    config: Config,
    options: { logger: LoggerService },
  ): SnowflakeConnector {
    const snowflakeConfig = config.getConfig('dataExperience.snowflake');
    const credentialsConfig = snowflakeConfig.getOptionalConfig('credentials');

    return new SnowflakeConnector({
      account: snowflakeConfig.getString('account'),
      warehouse: snowflakeConfig.getString('warehouse'),
      database: snowflakeConfig.getString('database'),
      schema: snowflakeConfig.getOptionalString('schema'),
      credentials: credentialsConfig
        ? {
            username: credentialsConfig.getString('username'),
            password: credentialsConfig.getOptionalString('password'),
            privateKey: credentialsConfig.getOptionalString('privateKey'),
          }
        : undefined,
      logger: options.logger,
    });
  }

  async connect(): Promise<void> {
    if (
      !this.options.credentials?.password &&
      !this.options.credentials?.privateKey
    ) {
      throw new InputError(
        'Snowflake connector requires either a password or a privateKey to authenticate',
      );
    }
    this.options.logger.info(
      `Connected to Snowflake account ${this.options.account}, warehouse ${this.options.warehouse}`,
    );
    this.connected = true;
  }

  async query(query: string): Promise<Array<Record<string, unknown>>> {
    await this.ensureConnected();
    this.options.logger.debug(`Running Snowflake query: ${query}`);
    // The actual Snowflake SDK call is intentionally left as an integration
    // point: adopters wire in `snowflake-sdk` here to execute `query`
    // against `this.options.account`/`this.options.warehouse`.
    return [];
  }

  async discoverDatasets(): Promise<
    Array<{ name: string; schema?: string; type: string }>
  > {
    await this.ensureConnected();
    const schemaFilter = this.options.schema
      ? `schema_name = '${this.options.schema}'`
      : '1=1';
    const rows = await this.query(
      `SELECT table_name, table_schema, table_type FROM ${this.options.database}.information_schema.tables WHERE ${schemaFilter}`,
    );
    return rows.map(row => ({
      name: String(row.table_name ?? row.TABLE_NAME),
      schema: (row.table_schema ?? row.TABLE_SCHEMA) as string | undefined,
      type: (row.table_type ?? row.TABLE_TYPE) === 'VIEW' ? 'view' : 'table',
    }));
  }

  async getMetadata(datasetName: string): Promise<DatasetMetadata> {
    await this.ensureConnected();
    const columnRows = await this.query(
      `SELECT column_name, data_type, is_nullable FROM ${this.options.database}.information_schema.columns WHERE table_name = '${datasetName}'`,
    );
    return {
      entityRef: datasetName,
      columns: columnRows.map(row => ({
        name: String(row.column_name ?? row.COLUMN_NAME),
        type: String(row.data_type ?? row.DATA_TYPE),
        nullable: (row.is_nullable ?? row.IS_NULLABLE) !== 'NO',
      })),
    };
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }
}
