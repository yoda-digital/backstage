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
  await knex.schema.createTable('insights_events', table => {
    table.increments('id').primary();
    table.string('event_type').notNullable().index();
    table.string('user_ref').notNullable().index();
    table.string('target').index();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table
      .timestamp('timestamp', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now())
      .index();
  });

  await knex.schema.createTable('insights_aggregations', table => {
    table.string('key').notNullable();
    table.string('period').notNullable();
    table.integer('count').notNullable().defaultTo(0);
    table.timestamp('period_start', { useTz: true }).notNullable();
    table.primary(['key', 'period', 'period_start']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('insights_aggregations');
  await knex.schema.dropTableIfExists('insights_events');
};
