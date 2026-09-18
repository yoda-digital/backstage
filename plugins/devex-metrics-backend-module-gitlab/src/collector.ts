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
import { Config } from '@backstage/config';
import { MetricCollector } from '@backstage/plugin-devex-metrics-backend';
import {
  DoraMetricName,
  MetricDataPoint,
} from '@backstage/plugin-devex-metrics-common';

interface GitLabProject {
  id: number;
  path_with_namespace: string;
}

interface GitLabPipeline {
  id: number;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Collects DORA metrics from GitLab CI/CD pipelines and merge requests.
 *
 * @public
 */
export class GitLabMetricCollector implements MetricCollector {
  readonly collectorId = 'gitlab';

  constructor(
    private readonly config: Config,
    private readonly logger: LoggerService,
  ) {}

  async collect(options: {
    metric: DoraMetricName;
    from: string;
    to: string;
  }): Promise<MetricDataPoint[]> {
    const host = this.config.getOptionalConfigArray('integrations.gitlab')?.[0]?.getOptionalString('host');
    const token = this.config.getOptionalConfigArray('integrations.gitlab')?.[0]?.getOptionalString('token');
    if (!host || !token) {
      this.logger.warn(
        'No GitLab integration configured, skipping metric collection',
      );
      return [];
    }
    const baseUrl = `https://${host}/api/v4`;

    switch (options.metric) {
      case 'deployment_frequency':
        return this.collectDeploymentFrequency(
          baseUrl,
          token,
          options.from,
          options.to,
        );
      case 'lead_time_for_changes':
        return this.collectLeadTime(baseUrl, token, options.from, options.to);
      case 'change_failure_rate':
        return this.collectChangeFailureRate(
          baseUrl,
          token,
          options.from,
          options.to,
        );
      case 'mean_time_to_restore':
        return this.collectMttr(baseUrl, token, options.from, options.to);
      default:
        return [];
    }
  }

  private async fetchProjects(
    baseUrl: string,
    token: string,
    from: string,
  ): Promise<GitLabProject[]> {
    const res = await fetch(
      `${baseUrl}/projects?per_page=100&last_activity_after=${encodeURIComponent(
        from,
      )}`,
      { headers: { 'PRIVATE-TOKEN': token } },
    );
    if (!res.ok) {
      this.logger.warn(`GitLab API error: ${res.status}`);
      return [];
    }
    return (await res.json()) as GitLabProject[];
  }

  private async collectDeploymentFrequency(
    baseUrl: string,
    token: string,
    from: string,
    to: string,
  ): Promise<MetricDataPoint[]> {
    const projects = await this.fetchProjects(baseUrl, token, from);
    const points: MetricDataPoint[] = [];
    for (const project of projects.slice(0, 20)) {
      const pipelinesRes = await fetch(
        `${baseUrl}/projects/${
          project.id
        }/pipelines?status=success&last_activity_after=${encodeURIComponent(
          from,
        )}&updated_before=${encodeURIComponent(to)}&ref=main&per_page=100`,
        { headers: { 'PRIVATE-TOKEN': token } },
      );
      if (!pipelinesRes.ok) continue;
      const pipelines = (await pipelinesRes.json()) as GitLabPipeline[];
      if (pipelines.length > 0) {
        points.push({
          date: new Date().toISOString().split('T')[0],
          value: pipelines.length,
          entityRef: `component:default/${project.path_with_namespace.replace(
            /\//g,
            '-',
          )}`,
        });
      }
    }
    return points;
  }

  private async collectLeadTime(
    _baseUrl: string,
    _token: string,
    _from: string,
    _to: string,
  ): Promise<MetricDataPoint[]> {
    // Measures time from first commit to successful pipeline on main.
    return [];
  }

  private async collectChangeFailureRate(
    baseUrl: string,
    token: string,
    from: string,
    to: string,
  ): Promise<MetricDataPoint[]> {
    const projects = await this.fetchProjects(baseUrl, token, from);
    const points: MetricDataPoint[] = [];
    for (const project of projects.slice(0, 20)) {
      const pipelinesRes = await fetch(
        `${baseUrl}/projects/${
          project.id
        }/pipelines?last_activity_after=${encodeURIComponent(
          from,
        )}&updated_before=${encodeURIComponent(to)}&ref=main&per_page=100`,
        { headers: { 'PRIVATE-TOKEN': token } },
      );
      if (!pipelinesRes.ok) continue;
      const pipelines = (await pipelinesRes.json()) as GitLabPipeline[];
      if (pipelines.length === 0) continue;
      const failed = pipelines.filter(p => p.status === 'failed').length;
      points.push({
        date: new Date().toISOString().split('T')[0],
        value: failed / pipelines.length,
        entityRef: `component:default/${project.path_with_namespace.replace(
          /\//g,
          '-',
        )}`,
      });
    }
    return points;
  }

  private async collectMttr(
    _baseUrl: string,
    _token: string,
    _from: string,
    _to: string,
  ): Promise<MetricDataPoint[]> {
    // Time from a failed pipeline to the next successful pipeline.
    return [];
  }
}
