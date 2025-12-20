import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Job } from './entities/job.entity';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobsProcessor } from './jobs.processor';
import { JobsResolver } from './jobs.resolver';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job]),
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
  ],
  controllers: [JobsController],
  providers: [JobsService, JobsProcessor, JobsResolver],
  exports: [JobsService],
})
export class JobsModule {}
