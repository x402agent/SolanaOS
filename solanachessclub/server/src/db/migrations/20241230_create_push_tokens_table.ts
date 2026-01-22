import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('push_tokens', (table) => {
    table.increments('id').primary();
    table.string('user_id', 255).notNullable();
    table.string('expo_push_token', 500).notNullable().unique();
    table.string('device_id', 255);
    table.string('platform', 20).notNullable(); // 'ios' or 'android'
    table.string('app_version', 50);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('last_used_at').defaultTo(knex.fn.now());

    // Indexes for performance
    table.index('user_id');
    table.index('is_active');
    table.index('platform');
    table.index(['user_id', 'is_active']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('push_tokens');
} 