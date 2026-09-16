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
import { NotFoundError } from '@backstage/errors';
import {
  DatasetMetadata,
  WarehouseType,
} from '@backstage/plugin-data-experience-common';
import { WarehouseConnector } from '@backstage/plugin-data-experience-node';
import { DbtManifest } from '../manifest/DbtManifest';

/**
 * A {@link @backstage/plugin-data-experience-node#WarehouseConnector} backed
 * by a dbt manifest: it discovers dbt models and sources as datasets, and
 * reports their columns as metadata. Cross-dataset lineage derived from the
 * manifest's `depends_on` graph is exposed via {@link DbtManifest} and wired
 * into the catalog as relations by the accompanying `DbtLineageProcessor`.
 *
 * @public
 */
export class DbtConnector implements WarehouseConnector {
  readonly connectorId = 'dbt';
  readonly warehouseType: WarehouseType = 'dbt';

  private manifest: DbtManifest | undefined;

  private constructor(
    private readonly config: Config,
    private readonly logger: LoggerService,
  ) {}

  static fromConfig(
    config: Config,
    options: { logger: LoggerService },
  ): DbtConnector {
    return new DbtConnector(config, options.logger);
  }

  async connect(): Promise<void> {
    this.manifest = await DbtManifest.fromConfig(this.config);
    this.logger.info(
      `Loaded dbt manifest with ${
        this.manifest.listNodes().length
      } models and sources`,
    );
  }

  async query(): Promise<Array<Record<string, unknown>>> {
    // dbt is a transformation and metadata layer, not a queryable warehouse
    // in its own right: query execution happens against the underlying
    // warehouse connector for the model's database/schema.
    return [];
  }

  async discoverDatasets(): Promise<
    Array<{ name: string; schema?: string; type: string }>
  > {
    const manifest = await this.ensureConnected();
    return manifest.listNodes().map(node => ({
      name: node.name,
      schema: node.schema,
      type: node.resourceType === 'model' ? 'view' : 'table',
    }));
  }

  async getMetadata(datasetName: string): Promise<DatasetMetadata> {
    const manifest = await this.ensureConnected();
    const node = manifest.getByName(datasetName);
    if (!node) {
      throw new NotFoundError(`No dbt node found with name ${datasetName}`);
    }
    return {
      entityRef: datasetName,
      columns: node.columns.map(column => ({
        name: column.name,
        type: column.type ?? 'unknown',
        nullable: true,
      })),
    };
  }

  /**
   * Returns the names of the datasets that the named dbt model or source
   * directly depends on, for use in building lineage relations.
   */
  async getDependencyNames(datasetName: string): Promise<string[]> {
    const manifest = await this.ensureConnected();
    return manifest.getDependencies(datasetName).map(node => node.name);
  }

  private async ensureConnected(): Promise<DbtManifest> {
    if (!this.manifest) {
      await this.connect();
    }
    return this.manifest!;
  }
}
