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
import { createCorsOriginValidator } from './common/http/cors-origin.util';
import { configureTrustProxy } from './common/http/trust-proxy.util';
import { isSwaggerEnabled } from './common/http/swagger-enabled.util';
import {
  getMissingRuntimeConfig,
  hasDatabaseConfig,
  hasQueueConfig,
  isStrictRuntime,
} from './common/runtime/runtime-config.util';
import { isGraphqlEnabled } from './config/graphql.config';

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
    authMode:
      process.env.AUTH_PROVIDER ||
      (process.env.NODE_ENV === 'development' ? 'local-admin-jwt' : 'jwt'),
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
  const strict = isStrictRuntime();
  const missing = getMissingRuntimeConfig();

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
  const { ErrorMonitoringService } = await import(
    './common/monitoring/error-monitoring.service'
  );
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

  app.getHttpAdapter().getInstance().disable('x-powered-by');
  configureTrustProxy(app);

  app.use(requestContextMiddleware);
  app.use(requestLoggingMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalFilters(new ApiExceptionFilter(app.get(ErrorMonitoringService)));
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

  app.enableCors({
    origin: createCorsOriginValidator(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'x-api-key',
      'x-request-id',
    ],
    exposedHeaders: ['x-request-id'],
  });

  const swaggerEnabled = isSwaggerEnabled();
  if (swaggerEnabled) {
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
      .addApiKey(
        {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Integration API key (header: x-api-key)',
        },
        'x-api-key',
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
  }

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);

  logger.log(`🚀 Application running on: http://${host}:${port}`);
  if (swaggerEnabled) {
    logger.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
  } else {
    logger.log('📚 API Documentation: disabled (SWAGGER_ENABLED=false)');
  }
  logger.log(
    isGraphqlEnabled()
      ? `🔮 GraphQL Playground: http://${host}:${port}/graphql`
      : '🔮 GraphQL: disabled',
  );
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
