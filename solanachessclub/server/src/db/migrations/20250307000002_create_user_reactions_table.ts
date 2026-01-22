import {Knex} from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create the "user_reactions" table to track individual user reactions
  await knex.schema.createTable('user_reactions', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    
    // Reference to the post being reacted to
    table
      .uuid('post_id')
      .notNullable()
      .references('id')
      .inTable('posts')
      .onDelete('CASCADE');
    
    // Reference to the user who reacted
    table
      .string('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    
    // The emoji reaction
    table.string('reaction_emoji').notNullable();
    
    // Timestamp for when the reaction was created
    table.timestamp('created_at', {useTz: true}).defaultTo(knex.fn.now());
    
    // Ensure a user can only have one reaction per post
    table.unique(['post_id', 'user_id']);
    
    // Index for faster queries
    table.index(['post_id']);
    table.index(['user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_reactions');
} 