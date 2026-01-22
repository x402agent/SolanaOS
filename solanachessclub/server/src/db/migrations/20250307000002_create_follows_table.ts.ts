import { Knex } from 'knex';

/**
 * This migration creates a 'follows' table to track user follow relationships.
 *
 * - follower_id: the user who follows someone
 * - following_id: the user who is being followed
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('follows', table => {
    // We store the wallet address (userId) as a string
    table.string('follower_id').notNullable();
    table.string('following_id').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    // Composite primary key on (follower_id, following_id)
    table.primary(['follower_id', 'following_id']);

    // Make sure they reference the users table
    table
      .foreign('follower_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    table
      .foreign('following_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('follows');
}
