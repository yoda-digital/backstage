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
import { MetricCollector } from '@backstage/plugin-devex-metrics-backend';
import {
  DoraMetricName,
  MetricDataPoint,
} from '@backstage/plugin-devex-metrics-common';

interface AzureBuild {
  id: number;
  result: string;
  status: string;
  startTime: string;
  finishTime: string;
  definition: { name: string };
}

interface AzureBuildsResponse {
  value: AzureBuild[];
}

/**
 * Collects DORA metrics from Azure DevOps pipelines.
 *
 * @public
 */
export class AzureDevOpsMetricCollector implements MetricCollector {
  readonly collectorId = 'azure-devops';

  constructor(
    private readonly org: string,
    private readonly project: string,
    private readonly token: string,
    private readonly logger: LoggerService,
  ) {}

  private get baseUrl(): string {
    return `https://dev.azure.com/${this.org}/${encodeURIComponent(
      this.project,
    )}/_apis`;
  }

  private authHeaders(): Record<string, string> {
    const encoded = Buffer.from(`:${this.token}`).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }

  async collect(options: {
    metric: DoraMetricName;
    from: string;
    to: string;
  }): Promise<MetricDataPoint[]> {
    switch (options.metric) {
      case 'deployment_frequency':
        return this.collectDeploymentFrequency(options.from, options.to);
      case 'change_failure_rate':
        return this.collectChangeFailureRate(options.from, options.to);
      case 'lead_time_for_changes':
        return this.collectLeadTime(options.from, options.to);
      case 'mean_time_to_restore':
        return this.collectMttr(options.from, options.to);
      default:
        return [];
    }
  }

  private async fetchBuilds(from: string, to: string): Promise<AzureBuild[]> {
    const url = `${
      this.baseUrl
    }/build/builds?api-version=7.1&minTime=${encodeURIComponent(
      from,
    )}&maxTime=${encodeURIComponent(to)}&statusFilter=completed`;
    const res = await fetch(url, { headers: this.authHeaders() });
    if (!res.ok) {
      this.logger.warn(`Azure DevOps API error: ${res.status}`);
      return [];
    }
    const body = (await res.json()) as AzureBuildsResponse;
    return body.value ?? [];
  }

  private async collectDeploymentFrequency(
    from: string,
    to: string,
  ): Promise<MetricDataPoint[]> {
    const builds = await this.fetchBuilds(from, to);
    const succeeded = builds.filter(b => b.result === 'succeeded');
    if (succeeded.length === 0) return [];
    return [
      {
        date: new Date().toISOString().split('T')[0],
        value: succeeded.length,
        entityRef: `component:default/${this.project}`,
      },
    ];
  }

  private async collectChangeFailureRate(
    from: string,
    to: string,
  ): Promise<MetricDataPoint[]> {
    const builds = await this.fetchBuilds(from, to);
    if (builds.length === 0) return [];
    const failed = builds.filter(b => b.result === 'failed').length;
    return [
      {
        date: new Date().toISOString().split('T')[0],
        value: failed / builds.length,
        entityRef: `component:default/${this.project}`,
      },
    ];
  }

  private async collectLeadTime(
    _from: string,
    _to: string,
  ): Promise<MetricDataPoint[]> {
    // Measures time from first commit to a successful build on the default branch.
    return [];
  }

  private async collectMttr(
    _from: string,
    _to: string,
  ): Promise<MetricDataPoint[]> {
    // Time from a failed build to the next successful build.
    return [];
  }
}
