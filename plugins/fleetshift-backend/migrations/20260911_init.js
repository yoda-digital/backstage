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
  await knex.schema.createTable('fleetshift_shifts', table => {
    table.string('id').primary().notNullable();
    table.string('title').notNullable();
    table.text('description').defaultTo('');
    table.text('transformation').notNullable();
    table.jsonb('targets').notNullable();
    table.string('status').notNullable().defaultTo('created');
    table.jsonb('plan');
    table.string('created_by').notNullable();
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('fleetshift_executions', table => {
    table.increments('id').primary();
    table
      .string('shift_id')
      .notNullable()
      .references('id')
      .inTable('fleetshift_shifts')
      .onDelete('CASCADE');
    table.string('target_repo_url').notNullable();
    table.string('status').notNullable().defaultTo('pending');
    table.string('mr_url');
    table.text('error');
    table.timestamp('started_at', { useTz: true });
    table.timestamp('completed_at', { useTz: true });
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('fleetshift_executions');
  await knex.schema.dropTableIfExists('fleetshift_shifts');
};
