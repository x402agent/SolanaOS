import * as path from 'path';
import type { Knex } from 'knex';
import dotenv from 'dotenv';
dotenv.config();

// Use Knex.Config type (might need adjustment if default import changes things)
const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './src/db/migrations', 
    },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: path.resolve(__dirname, 'migrations'),
    },
    pool: { min: 2, max: 10 },
  },
};

export default config;
