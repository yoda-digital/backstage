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

import { Knex } from 'knex';

/**
 * Applies the Soundcheck database schema, creating tables if they do not
 * already exist.
 *
 * @internal
 */
export async function applyMigrations(knex: Knex): Promise<void> {
  await knex.schema.createTableIfNotExists('soundcheck_facts', table => {
    table.string('fact_ref').notNullable();
    table.string('entity_ref').notNullable();
    table.jsonb('data').notNullable();
    table.timestamp('collected_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('expires_at').nullable();
    table.primary(['fact_ref', 'entity_ref']);
    table.index(['entity_ref']);
  });

  await knex.schema.createTableIfNotExists('soundcheck_checks', table => {
    table.string('id').primary();
    table.string('name').notNullable();
    table.text('description').notNullable();
    table.string('fact_ref').notNullable();
    table.jsonb('rule').notNullable();
    table.string('owner_entity_ref').nullable();
    table.jsonb('filter').nullable();
  });

  await knex.schema.createTableIfNotExists(
    'soundcheck_check_results',
    table => {
      table.string('check_id').notNullable();
      table.string('entity_ref').notNullable();
      table.string('status').notNullable();
      table.text('message').nullable();
      table.timestamp('evaluated_at').notNullable().defaultTo(knex.fn.now());
      table.primary(['check_id', 'entity_ref']);
      table.index(['entity_ref']);
    },
  );

  await knex.schema.createTableIfNotExists('soundcheck_tracks', table => {
    table.string('id').primary();
    table.string('name').notNullable();
    table.text('description').notNullable();
    table.string('owner_entity_ref').nullable();
    table.jsonb('levels').notNullable();
    table.jsonb('filter').nullable();
  });

  await knex.schema.createTableIfNotExists('soundcheck_campaigns', table => {
    table.string('id').primary();
    table.string('name').notNullable();
    table.text('description').notNullable();
    table
      .string('track_id')
      .notNullable()
      .references('id')
      .inTable('soundcheck_tracks');
    table.string('target_level').notNullable();
    table.timestamp('start_date').notNullable();
    table.timestamp('end_date').notNullable();
    table.jsonb('target_filter').nullable();
    table.string('owner_entity_ref').nullable();
  });

  await knex.schema.createTableIfNotExists(
    'soundcheck_certifications',
    table => {
      table.string('entity_ref').notNullable();
      table
        .string('track_id')
        .notNullable()
        .references('id')
        .inTable('soundcheck_tracks');
      table.string('level_name').notNullable();
      table.integer('level_rank').notNullable();
      table.timestamp('certified_at').notNullable().defaultTo(knex.fn.now());
      table.primary(['entity_ref', 'track_id']);
    },
  );
}
