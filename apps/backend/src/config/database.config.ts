import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * Enterprise connection settings. Under concurrent load the #1 cause of a crash
 * is pool exhaustion (every request waits on a free connection, then times out)
 * or a dropped Supabase connection taking the process down. These options bound
 * the pool, fail fast instead of hanging, and auto-recover from transient drops.
 */
/** Pull `?schema=x` out of a connection string; undefined means the default. */
export function schemaFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const m = /[?&]schema=([^&]+)/.exec(url);
  return m ? decodeURIComponent(m[1]) : undefined;
}

export const getDatabaseConfig = (config: ConfigService): TypeOrmModuleOptions => {
  const isProd = config.get('NODE_ENV') === 'production';

  // Pool size per app instance. Supabase's transaction pooler (port 6543) allows
  // many client connections, so this can be raised via env. Keep it modest per
  // instance so N instances don't collectively exhaust the database.
  const poolMax = Number(config.get('DB_POOL_MAX')) || 20;

  const base = {
    type: 'postgres' as const,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: !isProd,
    // Log only errors — logging every query slows each request and floods logs.
    logging: ['error'] as ('error')[],
    // Surface slow queries (>2s) in logs so hot paths are visible before they hurt.
    maxQueryExecutionTime: 2000,
    // Recover from transient connection drops instead of crashing on boot/runtime.
    retryAttempts: 10,
    retryDelay: 3000,
    keepConnectionAlive: true,
    // node-postgres pool + per-connection safety timeouts (passed straight to `pg`).
    extra: {
      max: poolMax,
      // Fail fast if no connection is free within 10s rather than hanging forever.
      connectionTimeoutMillis: 10_000,
      // Reap idle connections so we don't sit on Supabase's connection budget.
      idleTimeoutMillis: 30_000,
      // Kill any single query that runs longer than 15s (a runaway query would
      // otherwise pin a connection and starve everyone else).
      statement_timeout: 15_000,
      query_timeout: 15_000,
      // Never let an idle-in-transaction session hold a connection hostage.
      idle_in_transaction_session_timeout: 30_000,
      // TCP keepalive so dead connections are detected and dropped promptly.
      keepAlive: true,
    } as Record<string, unknown>,
  };

  // Hosted Postgres (e.g. Supabase) via a single connection string. SSL required.
  const url = config.get<string>('DATABASE_URL');
  if (url) {
    return {
      ...base,
      url,
      // TypeORM does NOT read `?schema=` from the connection string — without
      // this the tables would silently be created in `public` instead.
      schema: config.get<string>('DB_SCHEMA') || schemaFromUrl(url),
      ssl: { rejectUnauthorized: false },
      extra: {
        ...(base.extra as Record<string, unknown>),
        // Supabase's transaction pooler (port 6543) does not support the
        // prepared statements node-postgres would otherwise use.
        ...(url.includes('pgbouncer=true') ? { statement_timeout: undefined, max: Math.min(poolMax, 10) } : {}),
      },
    };
  }

  // Local Postgres (Docker) fallback.
  return {
    ...base,
    host: config.get<string>('DB_HOST', 'localhost'),
    port: config.get<number>('DB_PORT', 5432),
    username: config.get<string>('DB_USERNAME', 'hrms_user'),
    password: config.get<string>('DB_PASSWORD', 'hrms_password'),
    database: config.get<string>('DB_NAME', 'hrms_db'),
  };
};
