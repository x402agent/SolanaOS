/**
 * Migration to add image_url column to chat_messages table
 */
import { Knex } from 'knex';

/**
 * Add image_url column to chat_messages table
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('chat_messages', (table) => {
    table.text('image_url').nullable();
  });
}

/**
 * Remove image_url column from chat_messages table
 */
export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('chat_messages', (table) => {
    table.dropColumn('image_url');
  });
} 