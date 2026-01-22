# Database Directory

This directory contains the database configuration, connection setup, and migration files for the Solana App Kit server. We use PostgreSQL as our database system and Knex.js as the query builder and migration tool.

## Structure

- `knex.ts`: Database connection configuration
- `knexfile.ts`: Knex.js configuration for different environments
- `migrations/`: Directory containing all database migration files

## Database Configuration

The database connection is configured in `knex.ts` using environment variables:

```typescript
import Knex from 'knex';
import config from './knexfile';

const environment = process.env.NODE_ENV || 'development';
const knexConfig = config[environment];
const knex = Knex(knexConfig);

export default knex;
```

## Migrations

Database migrations are managed through Knex.js migration files in the `migrations/` directory. Migrations allow for version-controlled changes to the database schema.

### Migration Files

Migration files are named with a timestamp prefix, followed by a descriptive name:
- `20230101000000_create_users_table.ts`
- `20230201000000_add_profile_fields.ts`

Each migration file exports `up` and `down` functions:
- `up`: Applies the migration (creates tables, adds columns, etc.)
- `down`: Reverts the migration (drops tables, removes columns, etc.)

Example migration file:

```typescript
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('username').unique().notNullable();
    table.string('wallet_address').unique().notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('users');
}
```

### Running Migrations

Migrations can be run using the following commands:

```bash
# Apply all pending migrations
npx knex migrate:latest

# Rollback the last batch of migrations
npx knex migrate:rollback

# Run a specific migration
npx knex migrate:up 20230101000000_create_users_table.ts

# Create a new migration file
npx knex migrate:make create_new_table
```

## Database Schema

The database includes tables for:

### Users and Profiles
- `users`: User account information
- `profiles`: User profile details
- `follows`: User following relationships

### Social Features
- `threads`: Social media posts/threads
- `thread_likes`: Thread like interactions
- `thread_images`: Images attached to threads
- `comments`: Comments on threads

### Token Management
- `tokens`: Token information
- `markets`: Trading market information
- `stakes`: User staking positions
- `vesting_plans`: Token vesting schedules

## Query Patterns

When working with the database:

1. Import the knex instance:
   ```typescript
   import knex from '../db/knex';
   ```

2. Write your queries using the Knex.js query builder:
   ```typescript
   // Select query
   const users = await knex('users')
     .where({ active: true })
     .select('id', 'username');

   // Insert query
   const [userId] = await knex('users')
     .insert({
       username: 'newuser',
       wallet_address: 'solana123',
     })
     .returning('id');

   // Update query
   await knex('users')
     .where({ id: userId })
     .update({ username: 'updateduser' });

   // Delete query
   await knex('users')
     .where({ id: userId })
     .delete();
   ```

## Best Practices

- Use transactions for multi-table operations
- Create indexes for frequently queried columns
- Use parameterized queries to prevent SQL injection
- Keep migrations small and focused
- Write down migrations for all schema changes
- Add comments to explain complex migrations
- Use consistent naming conventions for tables and columns
- Implement soft deletes where appropriate (using a `deleted_at` timestamp)
