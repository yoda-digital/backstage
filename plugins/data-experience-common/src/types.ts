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

import { Entity } from '@backstage/catalog-model';

/**
 * A Dataset entity, describing a single unit of tabular, streamed, or file
 * based data exposed through the Data Experience plugin.
 *
 * @public
 */
export interface DatasetEntityV1alpha1 extends Entity {
  apiVersion: 'backstage.io/v1alpha1';
  kind: 'Dataset';
  spec: {
    type: 'table' | 'view' | 'topic' | 'file' | 'stream';
    warehouse: string;
    schema?: string;
    table?: string;
    owner: string;
    quality?: {
      freshness?: string;
      completeness?: number;
      lastChecked?: string;
    };
    tags?: string[];
  };
}

/**
 * The spec of a {@link DatasetEntityV1alpha1}.
 *
 * @public
 */
export type DatasetSpec = DatasetEntityV1alpha1['spec'];

/**
 * Data quality metrics for a dataset.
 *
 * @public
 */
export type DataQualityMetrics = NonNullable<DatasetSpec['quality']>;

/**
 * The supported warehouse types that datasets can originate from.
 *
 * @public
 */
export type WarehouseType =
  | 'bigquery'
  | 'snowflake'
  | 'postgresql'
  | 'redshift'
  | 's3'
  | 'dbt';

/**
 * Describes a connection to a data warehouse.
 *
 * @public
 */
export interface WarehouseConnection {
  readonly warehouseId: string;
  readonly type: WarehouseType;
  readonly displayName: string;
  readonly connectionConfig: Record<string, unknown>;
}

/**
 * Metadata about a dataset, as reported by a warehouse connector.
 *
 * @public
 */
export interface DatasetMetadata {
  readonly entityRef: string;
  readonly columns?: ColumnMetadata[];
  readonly rowCount?: number;
  readonly sizeBytes?: number;
  readonly lastUpdated?: string;
}

/**
 * Metadata about a single column of a dataset.
 *
 * @public
 */
export interface ColumnMetadata {
  readonly name: string;
  readonly type: string;
  readonly description?: string;
  readonly nullable: boolean;
}

/**
 * A single message in the discussion thread attached to a
 * {@link DatasetAccessRequest}.
 *
 * @public
 */
export interface AccessRequestComment {
  readonly authorRef: string;
  readonly message: string;
  readonly createdAt: string;
}

/**
 * A request for access to a dataset.
 *
 * @public
 */
export interface DatasetAccessRequest {
  readonly id: string;
  readonly datasetRef: string;
  readonly requestedBy: string;
  readonly reason: string;
  readonly status: 'pending' | 'approved' | 'denied';
  readonly conversation: AccessRequestComment[];
  readonly createdAt: string;
  readonly resolvedAt?: string;
}
