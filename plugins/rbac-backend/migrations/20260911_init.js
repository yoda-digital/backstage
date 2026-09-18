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
  if (!(await knex.schema.hasTable('rbac_roles'))) {
    await knex.schema.createTable('rbac_roles', table => {
      table.string('name').primary().notNullable();
      table.string('description').notNullable().defaultTo('');
      table.text('permissions').notNullable().defaultTo('[]');
      table.text('metadata').notNullable().defaultTo('{}');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable('rbac_bindings'))) {
    await knex.schema.createTable('rbac_bindings', table => {
      table.string('id').primary().notNullable();
      table
        .string('role')
        .notNullable()
        .references('name')
        .inTable('rbac_roles')
        .onDelete('CASCADE');
      // These three columns are kept deliberately short (rather than the
      // default 255) so that their combined length, together with `role`,
      // stays within MySQL's 3072-byte limit for a composite unique index
      // once encoded as utf8mb4.
      table.string('subject_kind', 16).notNullable();
      table.string('subject_name', 191).notNullable();
      table.string('subject_namespace', 64).defaultTo('default');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(
        ['role', 'subject_kind', 'subject_name', 'subject_namespace'],
        {
          indexName: 'rbac_bindings_subject_unique',
        },
      );
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('rbac_bindings');
  await knex.schema.dropTableIfExists('rbac_roles');
};
