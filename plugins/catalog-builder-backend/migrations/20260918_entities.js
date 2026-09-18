/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

// @ts-check

/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable('catalog_builder_entities'))) {
    await knex.schema.createTable('catalog_builder_entities', table => {
      table.string('name', 255).primary().notNullable();
      table.text('entity_yaml').notNullable();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('catalog_builder_entities');
};
