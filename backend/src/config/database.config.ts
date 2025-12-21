import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const databaseUrl = configService.get('DATABASE_URL');

  // If DATABASE_URL is provided, use it (Render, Railway, etc.)
  if (databaseUrl) {
    return {
      type: 'postgres',
      url: databaseUrl,
      entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
      synchronize: configService.get('NODE_ENV') !== 'production',
      logging: configService.get('NODE_ENV') === 'development',
      logger: 'advanced-console',
      ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
      extra: {
        max: configService.get<number>('DB_POOL_SIZE', 10),
        connectionTimeoutMillis: 5000,
      },
      retryAttempts: 3,
      retryDelay: 3000,
    };
  }

  // Otherwise, use individual connection parameters
  return {
    type: 'postgres',
    host: configService.get('DATABASE_HOST') || configService.get('DB_HOST', 'localhost'),
    port: configService.get<number>('DATABASE_PORT') || configService.get<number>('DB_PORT', 5432),
    username: configService.get('DATABASE_USER') || configService.get('DB_USERNAME', 'postgres'),
    password: configService.get('DATABASE_PASSWORD') || configService.get('DB_PASSWORD', 'postgres'),
    database: configService.get('DATABASE_NAME') || configService.get('DB_NAME', 'routing_dispatch'),
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    synchronize: configService.get('NODE_ENV') !== 'production',
    logging: configService.get('NODE_ENV') === 'development',
    logger: 'advanced-console',
    extra: {
      max: configService.get<number>('DB_POOL_SIZE', 10),
      connectionTimeoutMillis: 5000,
    },
    retryAttempts: 3,
    retryDelay: 3000,
  };
};

