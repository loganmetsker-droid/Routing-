import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { JobsModule } from '../jobs/jobs.module';
import { HealthController } from './health.controller';
import { StreamController } from './stream.controller';
import { WorkosModule } from '../../common/integrations/workos.module';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [TerminusModule, HttpModule, JobsModule, WorkosModule, DispatchModule],
  controllers: [HealthController, StreamController],
})
export class HealthModule {}
