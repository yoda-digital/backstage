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

import { readFile } from 'node:fs/promises';
import { Config } from '@backstage/config';
import { InputError } from '@backstage/errors';

/**
 * A single model or source node parsed from a dbt manifest.
 *
 * @public
 */
export interface DbtNode {
  readonly uniqueId: string;
  readonly name: string;
  readonly resourceType: 'model' | 'source';
  readonly database?: string;
  readonly schema?: string;
  readonly dependsOn: string[];
  readonly columns: Array<{ name: string; type?: string }>;
}

interface RawDbtNode {
  resource_type?: string;
  name?: string;
  database?: string;
  schema?: string;
  depends_on?: { nodes?: string[] };
  columns?: Record<string, { name?: string; data_type?: string }>;
}

interface RawDbtManifest {
  nodes?: Record<string, RawDbtNode>;
  sources?: Record<string, RawDbtNode>;
}

function toNode(uniqueId: string, raw: RawDbtNode): DbtNode | undefined {
  const resourceType = raw.resource_type;
  if (resourceType !== 'model' && resourceType !== 'source') {
    return undefined;
  }
  return {
    uniqueId,
    name: raw.name ?? uniqueId,
    resourceType,
    database: raw.database,
    schema: raw.schema,
    dependsOn: raw.depends_on?.nodes ?? [],
    columns: Object.values(raw.columns ?? {}).map(column => ({
      name: column.name ?? '',
      type: column.data_type,
    })),
  };
}

/**
 * A parsed dbt manifest, indexing models and sources by their dbt unique id
 * as well as by their table name for convenient lookup.
 *
 * @public
 */
export class DbtManifest {
  private constructor(
    private readonly nodesById: Map<string, DbtNode>,
    private readonly nodesByName: Map<string, DbtNode>,
  ) {}

  static fromRaw(raw: unknown): DbtManifest {
    const manifest = raw as RawDbtManifest;
    const nodesById = new Map<string, DbtNode>();
    const nodesByName = new Map<string, DbtNode>();

    for (const [uniqueId, rawNode] of Object.entries(manifest.nodes ?? {})) {
      const node = toNode(uniqueId, rawNode);
      if (node) {
        nodesById.set(uniqueId, node);
        nodesByName.set(node.name, node);
      }
    }
    for (const [uniqueId, rawNode] of Object.entries(manifest.sources ?? {})) {
      const node = toNode(uniqueId, { ...rawNode, resource_type: 'source' });
      if (node) {
        nodesById.set(uniqueId, node);
        nodesByName.set(node.name, node);
      }
    }

    return new DbtManifest(nodesById, nodesByName);
  }

  /**
   * Loads a manifest from the `dataExperience.dbt` configuration block,
   * either from a local `manifestPath` or by fetching the latest artifact
   * from dbt Cloud.
   */
  static async fromConfig(config: Config): Promise<DbtManifest> {
    const dbtConfig = config.getConfig('dataExperience.dbt');
    const manifestPath = dbtConfig.getOptionalString('manifestPath');
    if (manifestPath) {
      const contents = await readFile(manifestPath, 'utf-8');
      return DbtManifest.fromRaw(JSON.parse(contents));
    }

    const cloudConfig = dbtConfig.getOptionalConfig('cloud');
    if (cloudConfig) {
      const baseUrl =
        cloudConfig.getOptionalString('baseUrl') ?? 'https://cloud.getdbt.com';
      const accountId = cloudConfig.getString('accountId');
      const jobId = cloudConfig.getString('jobId');
      const apiToken = cloudConfig.getString('apiToken');

      const response = await fetch(
        `${baseUrl}/api/v2/accounts/${accountId}/jobs/${jobId}/artifacts/manifest.json`,
        { headers: { Authorization: `Token ${apiToken}` } },
      );
      if (!response.ok) {
        throw new InputError(
          `Failed to fetch dbt Cloud manifest: ${response.status} ${response.statusText}`,
        );
      }
      return DbtManifest.fromRaw(await response.json());
    }

    throw new InputError(
      'dataExperience.dbt must set either manifestPath or cloud',
    );
  }

  listNodes(): DbtNode[] {
    return Array.from(this.nodesById.values());
  }

  getByName(name: string): DbtNode | undefined {
    return this.nodesByName.get(name);
  }

  /**
   * Resolves the dbt nodes that the named node directly depends on.
   */
  getDependencies(name: string): DbtNode[] {
    const node = this.nodesByName.get(name);
    if (!node) {
      return [];
    }
    return node.dependsOn
      .map(id => this.nodesById.get(id))
      .filter((n): n is DbtNode => Boolean(n));
  }
}
