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

// @ts-check

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('devex_metric_points', table => {
    table.increments('id').primary();
    table.string('metric').notNullable().index();
    table.string('entity_ref').index();
    table.string('team').index();
    table.float('value').notNullable();
    table.timestamp('date', { useTz: true }).notNullable().index();
    table.string('source').notNullable();
    table
      .timestamp('collected_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('devex_surveys', table => {
    table.string('id').primary().notNullable();
    table.string('title').notNullable();
    table.text('description').defaultTo('');
    table.jsonb('questions').notNullable();
    table.boolean('active').notNullable().defaultTo(true);
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('devex_survey_responses', table => {
    table.increments('id').primary();
    table
      .string('survey_id')
      .notNullable()
      .references('id')
      .inTable('devex_surveys')
      .onDelete('CASCADE');
    table.string('respondent').notNullable();
    table.jsonb('answers').notNullable();
    table
      .timestamp('submitted_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.unique(['survey_id', 'respondent']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('devex_survey_responses');
  await knex.schema.dropTableIfExists('devex_surveys');
  await knex.schema.dropTableIfExists('devex_metric_points');
};
