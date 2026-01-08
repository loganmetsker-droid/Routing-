import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { BullModule } from '@nestjs/bull';
import { TerminusModule } from '@nestjs/terminus';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';

// Configuration
import { databaseConfig } from './config/database.config';
import { graphqlConfig } from './config/graphql.config';

// Guards
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { RoutesModule } from './modules/routes/routes.module';
import { DispatchesModule } from './modules/dispatches/dispatches.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';

@Module({
  imports: [
    // Global configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
      expandVariables: true,
    }),

    // Database - PostgreSQL with TimescaleDB
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: databaseConfig,
    }),

    // GraphQL - Apollo Server
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: graphqlConfig,
    }),

    // BullMQ - Job Queue Management (optional - disable if no Redis)
    ...(process.env.REDIS_HOST ? [
      BullModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          redis: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD'),
          },
        }),
      })
    ] : []),

    // Health checks and monitoring
    TerminusModule,
    HealthModule,
    MetricsModule,

    // Feature modules
    AuthModule,
    DriversModule,
    VehiclesModule,
    ShiftsModule,
    JobsModule,
    CustomersModule,
    DispatchModule,
    RoutesModule,
    DispatchesModule,
    TrackingModule,
    SubscriptionsModule,
  ],
  providers: [
    // Global JWT authentication guard
    // Use @Public() decorator to bypass authentication on specific endpoints
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
