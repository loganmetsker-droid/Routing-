import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Job } from './entities/job.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Route } from '../dispatch/entities/route.entity';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobsProcessor } from './jobs.processor';
import { JobsResolver } from './jobs.resolver';
import { PlatformModule } from '../platform/platform.module';
import './enums-registration'; // Register GraphQL enums

const hasRedis = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);

@Module({
  imports: [
    PlatformModule,
    TypeOrmModule.forFeature([Job, Customer, Route]),
    ...(hasRedis
      ? [
          BullModule.registerQueue({
            name: 'jobs',
            defaultJobOptions: {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
              removeOnComplete: false, // Keep completed jobs for debugging
              removeOnFail: false, // Keep failed jobs for debugging
            },
          }),
        ]
      : []),
  ],
  controllers: [JobsController],
  providers: [JobsService, JobsResolver, ...(hasRedis ? [JobsProcessor] : [])],
  exports: [JobsService],
})
export class JobsModule {}
