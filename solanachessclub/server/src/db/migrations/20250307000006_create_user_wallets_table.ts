import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // First, check if the old table exists
  const tableExists = await knex.schema.hasTable('user_wallets');
  
  // Create the table with our new desired structure
  if (!tableExists) {
    return knex.schema.createTable('user_wallets', (table) => {
      table.increments('id').primary();
      table.string('user_id').notNullable().index();
      table.string('wallet_address').notNullable().unique();
      table.string('provider').notNullable(); // privy, dynamic, turnkey, mwa
      table.string('name');
      table.boolean('is_primary').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Add foreign key constraint to users table
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('user_wallets');
}