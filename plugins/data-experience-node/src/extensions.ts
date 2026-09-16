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

import { createExtensionPoint } from '@backstage/backend-plugin-api';
import {
  DatasetMetadata,
  WarehouseType,
} from '@backstage/plugin-data-experience-common';

/**
 * A connector capable of discovering and describing datasets held by a
 * single data warehouse.
 *
 * @public
 */
export interface WarehouseConnector {
  readonly connectorId: string;
  readonly warehouseType: WarehouseType;

  /**
   * Connects to the underlying warehouse, verifying that the configured
   * credentials and connection details are valid.
   */
  connect(): Promise<void>;

  /**
   * Runs a query against the warehouse and returns the raw result rows.
   *
   * @param query - The query to execute, in the warehouse's native dialect.
   */
  query(query: string): Promise<Array<Record<string, unknown>>>;

  /**
   * Discovers the datasets that are currently available in the warehouse.
   */
  discoverDatasets(): Promise<
    Array<{ name: string; schema?: string; type: string }>
  >;

  /**
   * Fetches metadata, such as columns and row counts, for a single dataset.
   *
   * @param datasetName - The name of the dataset to describe.
   */
  getMetadata(datasetName: string): Promise<DatasetMetadata>;
}

/**
 * An extension point that allows other plugins to register
 * {@link WarehouseConnector}s with the Data Experience backend.
 *
 * @public
 */
export interface DataExperienceWarehouseExtensionPoint {
  /**
   * Registers a warehouse connector with the Data Experience backend.
   *
   * @param connector - The connector to add.
   */
  addConnector(connector: WarehouseConnector): void;
}

/**
 * The extension point used to register {@link WarehouseConnector}s with the
 * Data Experience backend.
 *
 * @public
 */
export const dataExperienceWarehouseExtensionPoint =
  createExtensionPoint<DataExperienceWarehouseExtensionPoint>({
    id: 'data-experience.warehouse',
  });
