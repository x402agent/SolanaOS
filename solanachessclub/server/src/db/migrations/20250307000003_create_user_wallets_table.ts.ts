import type { Knex } from 'knex';

/**
 * This migration creates a 'user_wallets' table to store all the extra wallets a user may have.
 * 
 * - user_id: references the users.id (which is the original wallet or primary user identity).
 * - wallet_address: the new wallet the user has imported.
 * 
 * We do NOT break existing references to posts, follows, etc.; those continue to use the original user_id.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_wallets', table => {
    table.increments('id').primary(); // auto-increment primary key
    table.string('user_id').notNullable(); // references the 'users' table's "id" which is the original wallet address
    table
      .foreign('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    
    table.string('wallet_address').notNullable();
    table.unique(['user_id', 'wallet_address']); // ensure no duplicates
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_wallets');
}
