import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add description column to users table if it doesn't exist
  await knex.schema.hasColumn('users', 'description').then(exists => {
    if (!exists) {
      return knex.schema.alterTable('users', table => {
        table.text('description').nullable();
      });
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop description column if it exists
  await knex.schema.hasColumn('users', 'description').then(exists => {
    if (exists) {
      return knex.schema.alterTable('users', table => {
        table.dropColumn('description');
      });
    }
  });
} 