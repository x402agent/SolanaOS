/**
 * File: migrations/20250307000008_create_chat_tables.ts
 * 
 * This migration creates two tables:
 * - chat_rooms: Stores information about chat conversations
 * - chat_messages: Stores individual messages in chat rooms
 */
import { Knex } from 'knex'; // Old import
// import Knex from 'knex'; // Try default import

// Adjust type hint for the knex parameter if needed based on default import
export async function up(knex: Knex): Promise<void> {
  // Create chat_rooms table
  await knex.schema.createTable('chat_rooms', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.enum('type', ['direct', 'group', 'global']).notNullable();
    table.string('name').nullable(); // For group chats
    table.jsonb('meta_data').nullable(); // For additional info
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  // Create chat_participants table to track users in each chat
  await knex.schema.createTable('chat_participants', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('chat_room_id').notNullable().references('id').inTable('chat_rooms').onDelete('CASCADE');
    table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.boolean('is_admin').defaultTo(false); // For group chats
    table.timestamps(true, true);
    
    // Create a unique constraint to ensure a user can only be in a chat room once
    table.unique(['chat_room_id', 'user_id']);
  });

  // Create chat_messages table
  await knex.schema.createTable('chat_messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('chat_room_id').notNullable().references('id').inTable('chat_rooms').onDelete('CASCADE');
    table.string('sender_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('content').notNullable();
    table.string('image_url').nullable(); // Added for image messages
    table.jsonb('additional_data').nullable(); // For things like NFT data, trade data, etc.
    table.boolean('is_deleted').defaultTo(false); // Soft delete flag
    table.timestamps(true, true);
    
    // Add index for faster querying of messages in a chat room
    table.index('chat_room_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order to avoid foreign key constraints
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_participants');
  await knex.schema.dropTableIfExists('chat_rooms');
} 