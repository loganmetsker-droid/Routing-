import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { BullModule } from '@nestjs/bull';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';

// Configuration
import { databaseConfig } from './config/database.config';
import { graphqlConfig } from './config/graphql.config';

// Guards
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { DepotsModule } from './modules/depots/depots.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { RoutesModule } from './modules/routes/routes.module';
import { DispatchesModule } from './modules/dispatches/dispatches.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { PlanningModule } from './modules/planning/planning.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { AuditModule } from './common/audit/audit.module';
import { RuntimeStatusModule } from './common/runtime/runtime-status.module';
import { WorkosModule } from './common/integrations/workos.module';

@Module({
  imports: [
    // Global configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env.local'),
        join(process.cwd(), '.env'),
        join(process.cwd(), '..', '.env.local'),
        join(process.cwd(), '..', '.env'),
      ],
      cache: true,
      expandVariables: true,
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),

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

    // BullMQ - Job Queue Management (optional)
    ...(process.env.REDIS_URL || process.env.REDIS_HOST
      ? [
          BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
              const redisUrl = configService.get<string>('REDIS_URL');

              if (redisUrl) {
                const parsed = new URL(redisUrl);
                return {
                  redis: {
                    host: parsed.hostname,
                    port: Number(parsed.port || 6379),
                    password: parsed.password || undefined,
                    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
                  },
                };
              }

              return {
                redis: {
                  host: configService.get('REDIS_HOST', 'localhost'),
                  port: configService.get('REDIS_PORT', 6379),
                  password: configService.get('REDIS_PASSWORD'),
                },
              };
            },
          }),
        ]
      : []),

    // Health checks and monitoring
    TerminusModule,
    WorkosModule,
    RuntimeStatusModule,
    HealthModule,
    MetricsModule,
    AuditModule,

    // Feature modules
    AuthModule,
    OrganizationsModule,
    DepotsModule,
    DriversModule,
    VehiclesModule,
    ShiftsModule,
    JobsModule,
    CustomersModule,
    DispatchModule,
    RoutesModule,
    DispatchesModule,
    TrackingModule,
    PlanningModule,
    SubscriptionsModule,
    NotificationsModule,
    PlatformModule,
    PublicApiModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
