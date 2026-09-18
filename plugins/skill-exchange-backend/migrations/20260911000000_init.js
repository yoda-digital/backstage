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
  if (!(await knex.schema.hasTable('skill_gigs'))) {
    await knex.schema.createTable('skill_gigs', table => {
      table.string('id').primary().notNullable();
      table.string('type').notNullable();
      table.string('title').notNullable();
      table.text('description').defaultTo('');
      table.jsonb('skills').notNullable().defaultTo('[]');
      table.string('direction').notNullable();
      table.string('created_by').notNullable();
      table.string('status').notNullable().defaultTo('open');
      table.string('matched_with');
      table.date('start_date');
      table.date('end_date');
      table
        .timestamp('created_at', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable('skill_profiles'))) {
    await knex.schema.createTable('skill_profiles', table => {
      table.string('user_ref').primary().notNullable();
      table.jsonb('skills').notNullable().defaultTo('[]');
      table.jsonb('interests').notNullable().defaultTo('[]');
      table.string('availability').defaultTo('partial');
      table
        .timestamp('updated_at', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable('skill_matches'))) {
    await knex.schema.createTable('skill_matches', table => {
      table.increments('id').primary();
      table
        .string('offer_id')
        .notNullable()
        .references('id')
        .inTable('skill_gigs');
      table
        .string('request_id')
        .notNullable()
        .references('id')
        .inTable('skill_gigs');
      table.float('score').notNullable();
      table.jsonb('matched_skills').notNullable();
      table
        .timestamp('matched_at', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('skill_matches');
  await knex.schema.dropTableIfExists('skill_profiles');
  await knex.schema.dropTableIfExists('skill_gigs');
};
