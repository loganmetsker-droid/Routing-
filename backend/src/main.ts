import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ApiResponseInterceptor } from './common/api/api-response.interceptor';
import { ApiExceptionFilter } from './common/api/api-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { config as loadDotEnv } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import helmet from 'helmet';
import {
  requestContextMiddleware,
  RequestWithContext,
} from './common/http/request-context.middleware';
import { requestLoggingMiddleware } from './common/http/request-logging.middleware';

function preloadEnvFiles() {
  const candidates = [
    join(process.cwd(), '.env.local'),
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '.env.local'),
    join(process.cwd(), '..', '.env'),
  ];

  const loaded: string[] = [];
  for (const file of candidates) {
    if (existsSync(file)) {
      loadDotEnv({ path: file, override: false });
      loaded.push(file);
    }
  }

  if (!process.env.TROVAN_ENV_SOURCES && loaded.length > 0) {
    process.env.TROVAN_ENV_SOURCES = loaded.join(',');
  }
}

function hasDatabaseConfig() {
  return Boolean(
    process.env.DATABASE_URL ||
      (process.env.DATABASE_HOST &&
        process.env.DATABASE_PORT &&
        process.env.DATABASE_NAME &&
        process.env.DATABASE_USER &&
        process.env.DATABASE_PASSWORD),
  );
}

function hasQueueConfig() {
  return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
}

function getConfigSummary() {
  const database =
    process.env.DATABASE_URL
      ? (() => {
          try {
            const url = new URL(process.env.DATABASE_URL as string);
            return {
              source: 'DATABASE_URL',
              host: url.hostname,
              port: url.port || '5432',
              database: url.pathname.replace(/^\//, '') || 'unknown',
            };
          } catch {
            return {
              source: 'DATABASE_URL',
              host: 'invalid',
              port: 'invalid',
              database: 'invalid',
            };
          }
        })()
      : {
          source: 'split-env',
          host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
          port: process.env.DATABASE_PORT || process.env.DB_PORT || '5432',
          database: process.env.DATABASE_NAME || process.env.DB_NAME || 'routing_dispatch',
        };

  return {
    envSource: process.env.TROVAN_ENV_SOURCES || 'process-environment',
    nodeEnv: process.env.NODE_ENV || 'development',
    authMode: process.env.NODE_ENV === 'development' ? 'local-admin-jwt' : 'jwt',
    queueMode: hasQueueConfig() ? 'redis' : 'disabled',
    queueRequired: String(process.env.QUEUE_REQUIRED || 'false') === 'true',
    optimizationMode:
      process.env.OPTIMIZATION_MODE ||
      (String(process.env.ENABLE_SCHEDULER || '0') === '1' ? 'embedded' : 'manual'),
    storageMode: process.env.STORAGE_MODE || 'local',
    database,
  };
}

function validateRuntimeConfig(logger: Logger) {
  const strict =
    String(process.env.STRICT_ENV_VALIDATION || 'false') === 'true' ||
    !['development', 'test'].includes(process.env.NODE_ENV || 'development');

  const missing: string[] = [];
  if (!process.env.JWT_SECRET) {
    missing.push('JWT_SECRET');
  }
  if (
    ['production', 'staging'].includes(process.env.NODE_ENV || '') &&
    !process.env.CORS_ORIGINS
  ) {
    missing.push('CORS_ORIGINS');
  }
  if (!hasDatabaseConfig()) {
    missing.push(
      'DATABASE_URL or DATABASE_HOST/DATABASE_PORT/DATABASE_NAME/DATABASE_USER/DATABASE_PASSWORD',
    );
  }
  if (String(process.env.QUEUE_REQUIRED || 'false') === 'true' && !hasQueueConfig()) {
    missing.push('REDIS_URL or REDIS_HOST');
  }

  if (missing.length > 0) {
    const message = `Missing required runtime config: ${missing.join(', ')}`;
    if (strict) {
      throw new Error(message);
    }
    logger.warn(message);
  }
}

async function bootstrap() {
  preloadEnvFiles();
  const { AppModule } = await import('./app.module');
  const logger = new Logger('Bootstrap');
  validateRuntimeConfig(logger);
  logger.log(`Runtime summary: ${JSON.stringify(getConfigSummary())}`);

  // Log environment for debugging
  logger.log(`Starting application in ${process.env.NODE_ENV || 'development'} mode`);
  logger.log(`Database URL present: ${!!process.env.DATABASE_URL}`);
  logger.log(`Port: ${process.env.PORT || 3000}`);

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    abortOnError: false,
    rawBody: true,
  });

  app.use(requestContextMiddleware);
  app.use(requestLoggingMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  // Global prefix for all routes
  app.setGlobalPrefix('api', {
    exclude: ['health', 'graphql', 'stream-route'],
  });

  // Global validation pipe with detailed error messages
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.length === 0 && process.env.NODE_ENV !== 'production') {
        const localOrigins = new Set([
          'http://localhost:5173',
          'http://localhost:5184',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:5184',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
        ]);
        return callback(localOrigins.has(origin) ? null : new Error('Origin not allowed'), localOrigins.has(origin));
      }

      const allowed = allowedOrigins.includes(origin);
      return callback(allowed ? null : new Error('Origin not allowed'), allowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Swagger/OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Routing & Dispatch SaaS API')
    .setDescription(
      'REST API for fleet management, route optimization, and real-time dispatching operations',
    )
    .setVersion('1.0.0')
    .addTag('health', 'Health check endpoints')
    .addTag('vehicles', 'Vehicle fleet management')
    .addTag('drivers', 'Driver management')
    .addTag('routes', 'Route planning and optimization')
    .addTag('jobs', 'Job and delivery management')
    .addTag('shifts', 'Driver shift management')
    .addTag('telemetry', 'Real-time GPS tracking')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      },
      'JWT-auth',
    )
    .addServer('http://localhost:3000', 'Local Development')
    .addServer('https://api.example.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Routing & Dispatch API Docs',
  });

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);

  logger.log(`🚀 Application running on: http://${host}:${port}`);
  logger.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
  logger.log(`🔮 GraphQL Playground: http://${host}:${port}/graphql`);
  logger.log(`❤️  Health Check: http://${host}:${port}/health`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application:', error);
  logger.error('Error stack:', error.stack);

  // Log specific database connection errors
  if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ECONNRESET')) {
    logger.error('❌ Database connection failed. Please check:');
    logger.error('   1. DATABASE_URL is set correctly');
    logger.error('   2. Database server is running and accessible');
    logger.error('   3. Firewall rules allow connections');
    logger.error('   4. SSL settings are correct for your database provider');
  }

  process.exit(1);
});
