import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (config: ConfigService): TypeOrmModuleOptions => {
  const base = {
    type: 'postgres' as const,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: config.get('NODE_ENV') !== 'production',
    logging: config.get('NODE_ENV') === 'development',
  };

  // Hosted Postgres (e.g. Supabase) via a single connection string. SSL is required.
  const url = config.get<string>('DATABASE_URL');
  if (url) {
    return {
      ...base,
      url,
      ssl: { rejectUnauthorized: false },
      extra: { max: 5 }, // keep the pool small for Supabase pooler limits
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
