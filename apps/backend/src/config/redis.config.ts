import { ConfigService } from '@nestjs/config';

export const getRedisConfig = (config: ConfigService) => ({
  host: config.get('REDIS_HOST', 'localhost'),
  port: config.get<number>('REDIS_PORT', 6379),
  password: config.get('REDIS_PASSWORD') || undefined,
  ttl: 300,
});
