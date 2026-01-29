import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Log environment for debugging
  logger.log(`Starting application in ${process.env.NODE_ENV || 'development'} mode`);
  logger.log(`Database URL present: ${!!process.env.DATABASE_URL}`);
  logger.log(`Port: ${process.env.PORT || 3000}`);

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    abortOnError: false, // Don't crash on startup errors
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api', {
    exclude: ['health', 'graphql'],
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

  // CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL?.split(',') || [
      'http://localhost:5173',
      'http://localhost:3000',
    ],
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

