import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { Logger } from '@nestjs/common';

const logger = new Logger('DatabaseConfig');

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const databaseUrl = configService.get('DATABASE_URL');
  const nodeEnv = configService.get('NODE_ENV') || 'development';
  const isProduction = nodeEnv === 'production';
  const allowSelfSignedSsl =
    configService.get<string>('DB_SSL_ALLOW_SELF_SIGNED', 'false') === 'true';

  if (
    configService.get<string>('TYPEORM_SYNCHRONIZE', 'false') === 'true' &&
    !['development', 'test', 'local'].includes(nodeEnv)
  ) {
    throw new Error(
      'TYPEORM_SYNCHRONIZE must remain disabled outside local development environments.',
    );
  }

  // Log database connection attempt
  if (databaseUrl) {
    // Validate DATABASE_URL format
    if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
      logger.error(`[DB:CONFIG] Invalid DATABASE_URL format. Must start with postgres:// or postgresql://`);
      logger.error(`[DB:CONFIG] Current value starts with: ${databaseUrl.substring(0, 15)}...`);
    }

    let parsedHost = 'unknown';
    let parsedPort = '5432';
    let parsedDb = 'unknown';
    try {
      const parsed = new URL(databaseUrl);
      parsedHost = parsed.hostname;
      parsedPort = parsed.port || '5432';
      parsedDb = parsed.pathname.replace(/^\//, '') || 'unknown';
    } catch {
      // keep defaults
    }
    logger.log(`[DB:CONFIG] Source: DATABASE_URL (${parsedHost}:${parsedPort}/${parsedDb})`);
    logger.log(
      `[DB:CONFIG] Environment: ${nodeEnv}, SSL: ${isProduction ? 'enabled' : 'disabled'}`,
    );
  } else {
    logger.log(`[DB:CONFIG] Source: individual connection params (DATABASE_HOST/DB_HOST, etc.)`);
  }

  // If DATABASE_URL is provided, use it (Render, Railway, etc.)
  if (databaseUrl) {
    // Determine if we should use SSL
    // Most cloud providers (Railway, Render, Supabase) require SSL for external connections
    const useSSL = isProduction ||
      databaseUrl.includes('railway.app') ||
      databaseUrl.includes('rlwy.net') ||
      databaseUrl.includes('render.com') ||
      databaseUrl.includes('supabase.co');

    const config: TypeOrmModuleOptions = {
      type: 'postgres',
      url: databaseUrl,
      entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
      migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
      synchronize: false,
      migrationsRun: false,
      logging: !isProduction ? ['error', 'warn', 'schema', 'migration'] : ['error'],
      logger: 'advanced-console',
      // SSL required for Render/Railway hosted PostgreSQL
      ssl: useSSL ? { rejectUnauthorized: !allowSelfSignedSsl } : false,
      extra: {
        ssl: useSSL ? { rejectUnauthorized: !allowSelfSignedSsl } : false,
        max: isProduction ? 3 : configService.get<number>('DB_POOL_SIZE', 5),
        min: 0,
        connectionTimeoutMillis: 30000,
        idleTimeoutMillis: 20000,
        statement_timeout: 60000,
        query_timeout: 60000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        application_name: 'routing-dispatch-backend',
      },
      retryAttempts: 15, // More retries for cold starts
      retryDelay: 5000, // 5 seconds between retries
    };

    // Use console.log to ensure output in Render logs even if Nest logger isn't ready
    if (useSSL) {
      console.log(
        `  [DB] SSL Connection Enabled (rejectUnauthorized=${allowSelfSignedSsl ? 'false' : 'true'})`,
      );
    }
    console.log(`  [DB] Pool Size: ${config.extra?.max}, Retries: ${config.retryAttempts}`);

    return config;
  }

  // Otherwise, use individual connection parameters
  const host = configService.get('DATABASE_HOST') || configService.get('DB_HOST', 'localhost');
  const port = configService.get<number>('DATABASE_PORT') || configService.get<number>('DB_PORT', 5432);
  const database = configService.get('DATABASE_NAME') || configService.get('DB_NAME', 'routing_dispatch');

  logger.log(`[DB:CONFIG] Connecting to ${host}:${port}/${database}`);

  return {
    type: 'postgres',
    host,
    port,
    username: configService.get('DATABASE_USER') || configService.get('DB_USERNAME', 'postgres'),
    password: configService.get('DATABASE_PASSWORD') || configService.get('DB_PASSWORD', 'postgres'),
    database,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
    synchronize: false,
    migrationsRun: false,
    logging: !isProduction ? ['error', 'warn', 'schema', 'migration'] : ['error'],
    logger: 'advanced-console',
    extra: {
      max: configService.get<number>('DB_POOL_SIZE', 5),
      min: 1,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    },
    retryAttempts: 5,
    retryDelay: 5000,
  };
};
