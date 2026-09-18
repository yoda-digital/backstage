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
  if (!(await knex.schema.hasTable('ai_assistant_conversations'))) {
    await knex.schema.createTable('ai_assistant_conversations', table => {
      table.uuid('id').primary().defaultTo(knex.fn.uuid());
      table.string('title').notNullable();
      table.string('mode_id').notNullable();
      table.string('user_entity_ref').notNullable();
      table
        .timestamp('created_at', { useTz: true })
        .defaultTo(knex.fn.now())
        .notNullable();
      table
        .timestamp('updated_at', { useTz: true })
        .defaultTo(knex.fn.now())
        .notNullable();
      table.index(['user_entity_ref']);
      table.index(['mode_id']);
    });
  }

  if (!(await knex.schema.hasTable('ai_assistant_messages'))) {
    await knex.schema.createTable('ai_assistant_messages', table => {
      table.uuid('id').primary().defaultTo(knex.fn.uuid());
      table
        .uuid('conversation_id')
        .notNullable()
        .references('id')
        .inTable('ai_assistant_conversations')
        .onDelete('CASCADE');
      table.string('role').notNullable();
      table.text('content').notNullable();
      table.text('sources').nullable();
      table
        .timestamp('created_at', { useTz: true })
        .defaultTo(knex.fn.now())
        .notNullable();
      table.index(['conversation_id']);
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('ai_assistant_messages');
  await knex.schema.dropTableIfExists('ai_assistant_conversations');
};
