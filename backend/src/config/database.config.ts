import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DATABASE_HOST') || configService.get('DB_HOST', 'localhost'),
  port: configService.get<number>('DATABASE_PORT') || configService.get<number>('DB_PORT', 5432),
  username: configService.get('DATABASE_USER') || configService.get('DB_USERNAME', 'postgres'),
  password: configService.get('DATABASE_PASSWORD') || configService.get('DB_PASSWORD', 'postgres'),
  database: configService.get('DATABASE_NAME') || configService.get('DB_NAME', 'routing_dispatch'),

  // Entity loading
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],

  // Auto-sync (disable in production!)
  synchronize: configService.get('NODE_ENV') !== 'production',

  // Logging
  logging: configService.get('NODE_ENV') === 'development',
  logger: 'advanced-console',

  // Connection pool
  extra: {
    max: configService.get<number>('DB_POOL_SIZE', 10),
    connectionTimeoutMillis: 5000,
  },

  // Retry connection
  retryAttempts: 3,
  retryDelay: 3000,
});

