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
  if (!(await knex.schema.hasTable('catalog_builder_jobs'))) {
    await knex.schema.createTable('catalog_builder_jobs', table => {
      table.string('id').notNullable();
      table.string('provider').notNullable();
      table.string('organization').notNullable();
      table.string('mode').notNullable();
      table.string('status').notNullable().defaultTo('pending');
      table.integer('total_repos').notNullable().defaultTo(0);
      table.integer('processed').notNullable().defaultTo(0);
      table.integer('succeeded').notNullable().defaultTo(0);
      table.integer('failed').notNullable().defaultTo(0);
      // Not given a database-level default: MySQL does not allow default
      // values on JSON columns, so JobStore always writes this explicitly.
      table.jsonb('errors').notNullable();
      table.string('created_by').notNullable();
      // A monotonically increasing counter used to order jobs, since
      // `created_at` alone is not fine-grained enough to disambiguate jobs
      // created within the same second (notably on SQLite).
      table.increments('seq', { primaryKey: false }).unique();
      table
        .timestamp('created_at', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
      table.timestamp('completed_at', { useTz: true });
      // Declared as an array so the primary key is emitted in a form that
      // MySQL's schema compiler can merge safely with the `seq` increments
      // column above (chaining `.primary()` on the column itself passes a
      // bare string here, which crashes that merge).
      table.primary(['id']);
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('catalog_builder_jobs');
};
