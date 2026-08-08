/**
 * Standalone TypeORM DataSource — used only by the `typeorm` CLI for
 * generating and running migrations. The running app builds its own options in
 * config/database.config.ts.
 *
 * Why this exists: production sets `synchronize: false`, and there were no
 * migrations at all. A fresh production database therefore got NO tables, and
 * because the health check only runs `SELECT 1` the pod reported healthy and
 * took traffic before failing every request with
 * `relation "users" does not exist`.
 *
 * DDL goes through DIRECT_URL (Supabase's session pooler) when present:
 * the transaction pooler on :6543 cannot reliably run schema changes.
 *
 *   npm run migration:generate --workspace=apps/backend -- src/migrations/Init
 *   npm run migration:run      --workspace=apps/backend
 *   npm run migration:revert   --workspace=apps/backend
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { schemaFromUrl } from './config/database.config';

dotenv.config();

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const schema = process.env.DB_SCHEMA || schemaFromUrl(url) || undefined;

export default new DataSource({
  type: 'postgres',
  ...(url
    ? { url, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        username: process.env.DB_USERNAME || 'hrms_user',
        password: process.env.DB_PASSWORD || 'hrms_password',
        database: process.env.DB_NAME || 'hrms_db',
      }),
  schema,
  // Glob both .ts (ts-node, dev) and .js (compiled, deploy).
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  // Never true here: the whole point is that schema changes are explicit.
  synchronize: false,
  logging: ['error', 'schema'],
});
