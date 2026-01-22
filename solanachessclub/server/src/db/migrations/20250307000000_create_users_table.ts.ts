import {Knex} from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create the "users" table.
  await knex.schema.createTable('users', table => {
    table.string('id').primary(); // Use wallet address as the primary key.
    table.string('username').notNullable();
    table.string('handle').notNullable();
    table.string('profile_picture_url').nullable();
    table.timestamps(true, true); // Automatically managed created_at & updated_at.
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
