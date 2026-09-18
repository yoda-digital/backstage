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

import { Knex } from 'knex';
import { resolvePackagePath } from '@backstage/backend-plugin-api';
import {
  MetricDataPoint,
  MetricQuery,
  SurveyDefinition,
  SurveyResponse,
} from '@backstage/plugin-devex-metrics-common';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-devex-metrics-backend',
  'migrations',
);

/** @internal */
export class MetricsStore {
  private constructor(private readonly db: Knex) {}

  static async create(options: { database: Knex }): Promise<MetricsStore> {
    await options.database.migrate.latest({
      directory: migrationsDir,
    tableName: 'knex_migrations_devex_metrics',
    });
    return new MetricsStore(options.database);
  }

  async recordMetric(
    metric: string,
    point: MetricDataPoint,
    source: string,
  ): Promise<void> {
    await this.db('devex_metric_points').insert({
      metric,
      entity_ref: point.entityRef,
      team: point.team,
      value: point.value,
      date: point.date,
      source,
    });
  }

  async queryMetrics(query: MetricQuery): Promise<MetricDataPoint[]> {
    let q = this.db('devex_metric_points')
      .where('metric', query.metric)
      .whereBetween('date', [query.timeRange.from, query.timeRange.to]);
    if (query.segment?.entityRef) {
      q = q.where('entity_ref', query.segment.entityRef);
    }
    if (query.segment?.team) {
      q = q.where('team', query.segment.team);
    }
    const rows = await q.orderBy('date', 'asc');
    return rows.map(row => ({
      date: row.date,
      value: row.value,
      entityRef: row.entity_ref ?? undefined,
      team: row.team ?? undefined,
    }));
  }

  async createSurvey(survey: SurveyDefinition): Promise<void> {
    await this.db('devex_surveys').insert({
      id: survey.id,
      title: survey.title,
      description: survey.description,
      questions: JSON.stringify(survey.questions),
      active: survey.active,
    });
  }

  async listSurveys(): Promise<SurveyDefinition[]> {
    const rows = await this.db('devex_surveys')
      .select('*')
      .orderBy('created_at', 'desc');
    return rows.map(row => this.rowToSurvey(row));
  }

  async getSurvey(surveyId: string): Promise<SurveyDefinition | undefined> {
    const row = await this.db('devex_surveys').where('id', surveyId).first();
    return row ? this.rowToSurvey(row) : undefined;
  }

  async submitResponse(response: SurveyResponse): Promise<void> {
    await this.db('devex_survey_responses')
      .insert({
        survey_id: response.surveyId,
        respondent: response.respondent,
        answers: JSON.stringify(response.answers),
      })
      .onConflict(['survey_id', 'respondent'])
      .merge();
  }

  async getSurveyResults(surveyId: string): Promise<SurveyResponse[]> {
    const rows = await this.db('devex_survey_responses').where(
      'survey_id',
      surveyId,
    );
    return rows.map(row => ({
      surveyId: row.survey_id,
      respondent: row.respondent,
      answers: JSON.parse(row.answers),
      submittedAt: row.submitted_at,
    }));
  }

  private rowToSurvey(row: {
    id: string;
    title: string;
    description: string;
    questions: string;
    active: boolean;
    created_at: string;
  }): SurveyDefinition {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      questions: JSON.parse(row.questions),
      active: row.active,
      createdAt: row.created_at,
    };
  }
}
