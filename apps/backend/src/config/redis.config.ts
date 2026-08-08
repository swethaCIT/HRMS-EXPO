import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { CacheModuleOptions } from '@nestjs/cache-manager';

const logger = new Logger('Cache');

/**
 * Build the cache backend.
 *
 * In-memory is per-process, which is wrong the moment there are two replicas:
 * `users.service` deletes `auth:user:<id>` after a role change, but only on the
 * instance that served the request — the other keeps handing out the stale role
 * for the rest of the TTL. Redis makes that invalidation global.
 *
 * It is opt-in (`REDIS_URL`, or `CACHE_DRIVER=redis`) rather than "on whenever
 * REDIS_HOST looks set", because a Redis that isn't actually running produced
 * connection-retry storms and slow, flaky startups. Unconfigured or
 * unreachable, we fall back to memory and log it, so the API always boots.
 */
export async function buildCacheOptions(config: ConfigService): Promise<CacheModuleOptions> {
  const ttl = 300_000; // 5 min, matching the previous in-memory default
  const url = redisUrlFrom(config);

  if (!url) {
    logger.log('Using in-memory cache (set REDIS_URL to share cache across instances)');
    return { isGlobal: true, ttl };
  }

  try {
    // Imported lazily so a deployment without Redis never loads the client.
    const { default: KeyvRedis } = await import('@keyv/redis');
    const store = new KeyvRedis(url);
    // Never let a cache outage take the API down — log and keep serving.
    store.on?.('error', (err: any) => logger.error(`Redis cache error: ${err?.message}`));
    logger.log(`Using Redis cache at ${safeUrl(url)}`);
    return { isGlobal: true, ttl, stores: [store] } as CacheModuleOptions;
  } catch (err: any) {
    logger.warn(`Redis cache unavailable (${err?.message}) — falling back to in-memory`);
    return { isGlobal: true, ttl };
  }
}

/** Explicit REDIS_URL wins; otherwise assemble one only when opted in. */
function redisUrlFrom(config: ConfigService): string | null {
  const explicit = config.get<string>('REDIS_URL');
  if (explicit) return explicit;
  if (config.get<string>('CACHE_DRIVER') !== 'redis') return null;

  const host = config.get<string>('REDIS_HOST', 'localhost');
  const port = config.get<string>('REDIS_PORT', '6379');
  const password = config.get<string>('REDIS_PASSWORD');
  return password
    ? `redis://:${encodeURIComponent(password)}@${host}:${port}`
    : `redis://${host}:${port}`;
}

/** Strip credentials before logging a connection string. */
function safeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.password = '';
    u.username = '';
    return u.toString();
  } catch {
    return 'redis';
  }
}
