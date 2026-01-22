import { Knex } from 'knex';

/**
 * Adds columns to store the user's attached coin info:
 *  - profile_coin_mint   (string, the mint address)
 *  - profile_coin_symbol (string, symbol for display)
 *  - profile_coin_name   (string, display name of the coin)
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', table => {
    table.string('profile_coin_mint').nullable();
    table.string('profile_coin_symbol').nullable();
    table.string('profile_coin_name').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', table => {
    table.dropColumn('profile_coin_mint');
    table.dropColumn('profile_coin_symbol');
    table.dropColumn('profile_coin_name');
  });
}
