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
  await knex.schema.createTable('rbac_policies', table => {
    table.string('id').primary().notNullable();
    table.string('name').notNullable();
    table.string('status').notNullable().defaultTo('draft');
    table.string('strategy').notNullable().defaultTo('first-match');
    // MySQL does not allow a literal default value on a JSON column, so
    // `rules` is left without a database-level default; every write path
    // in RbacStore always supplies it explicitly.
    table.jsonb('rules').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('published_at').nullable();
    table.index(['status']);
  });

  await knex.schema.createTable('rbac_conditional_rules', table => {
    table.string('id').primary().notNullable();
    table.string('name').notNullable();
    table.text('description').nullable();
    table.string('resource_type').notNullable();
    table.jsonb('params_schema').nullable();
    table.string('plugin_id').notNullable();
    table.unique(['plugin_id', 'name']);
  });

  await knex.schema.alterTable('rbac_roles', table => {
    table
      .string('policy_id')
      .nullable()
      .references('id')
      .inTable('rbac_policies')
      .onDelete('SET NULL');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.alterTable('rbac_roles', table => {
    table.dropColumn('policy_id');
  });
  await knex.schema.dropTableIfExists('rbac_conditional_rules');
  await knex.schema.dropTableIfExists('rbac_policies');
};
