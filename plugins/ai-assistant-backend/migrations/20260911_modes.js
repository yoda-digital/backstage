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
  await knex.schema.createTable('ai_modes', table => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('name').notNullable();
    table.text('description').notNullable();
    table.text('instructions').notNullable();
    table.string('visibility').notNullable().defaultTo('private');
    table.string('owner_ref').notNullable();
    table.jsonb('processors').notNullable().defaultTo('[]');
    table.jsonb('mcp_tools').nullable();
    table.string('model_override').nullable();
    table.integer('max_steps').nullable();
    table.float('temperature').nullable();
    table.integer('usage_count_30d').notNullable().defaultTo(0);
    table
      .timestamp('created_at', { useTz: true })
      .defaultTo(knex.fn.now())
      .notNullable();
    table
      .timestamp('updated_at', { useTz: true })
      .defaultTo(knex.fn.now())
      .notNullable();
    table.index(['owner_ref']);
    table.index(['visibility']);
    table.index(['usage_count_30d']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('ai_modes');
};
