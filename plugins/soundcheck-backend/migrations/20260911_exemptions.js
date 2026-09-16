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
  await knex.schema.createTable('soundcheck_exemptions', table => {
    table.string('id').primary().notNullable();
    table
      .string('check_id')
      .notNullable()
      .references('id')
      .inTable('soundcheck_checks');
    table.string('entity_ref').notNullable();
    table.text('reason').notNullable();
    table.string('granted_by').notNullable();
    table.timestamp('granted_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('revoked_at').nullable();
    table.string('revoked_by').nullable();
    table.string('status').notNullable().defaultTo('active');
    table.index(['check_id', 'entity_ref']);
    table.index(['status']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTable('soundcheck_exemptions');
};
