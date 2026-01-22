import {Knex} from 'knex';

/**
 * Adds a JSONB column "attachment_data" to store profile attachments.
 * For example, to store a coin attachment as:
 * { coin: { mint: string, symbol?: string, name?: string } }
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', table => {
    table.jsonb('attachment_data').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', table => {
    table.dropColumn('attachment_data');
  });
}
