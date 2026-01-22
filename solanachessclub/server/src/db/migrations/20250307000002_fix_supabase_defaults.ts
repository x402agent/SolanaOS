import {Knex} from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Fix default values for Supabase compatibility
  await knex.raw(`
    ALTER TABLE posts 
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN sections SET DEFAULT '[]'::jsonb,
    ALTER COLUMN reaction_count SET DEFAULT 0,
    ALTER COLUMN retweet_count SET DEFAULT 0,
    ALTER COLUMN quote_count SET DEFAULT 0,
    ALTER COLUMN reactions SET DEFAULT '{}'::jsonb,
    ALTER COLUMN created_at SET DEFAULT now();
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Remove the defaults (if needed for rollback)
  await knex.raw(`
    ALTER TABLE posts 
    ALTER COLUMN id DROP DEFAULT,
    ALTER COLUMN sections DROP DEFAULT,
    ALTER COLUMN reaction_count DROP DEFAULT,
    ALTER COLUMN retweet_count DROP DEFAULT,
    ALTER COLUMN quote_count DROP DEFAULT,
    ALTER COLUMN reactions DROP DEFAULT,
    ALTER COLUMN created_at DROP DEFAULT;
  `);
} 