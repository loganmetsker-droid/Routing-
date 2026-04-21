import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { JobsModule } from '../jobs/jobs.module';
import { HealthController } from './health.controller';
import { StreamController } from './stream.controller';

@Module({
  imports: [TerminusModule, HttpModule, JobsModule],
  controllers: [HealthController, StreamController],
})
export class HealthModule {}
