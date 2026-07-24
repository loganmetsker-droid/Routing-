import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { JobsModule } from '../jobs/jobs.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformModule } from '../platform/platform.module';
import { WorkosModule } from '../../common/integrations/workos.module';
import { HealthController } from './health.controller';
import { StreamController } from './stream.controller';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    JobsModule,
    DispatchModule,
    NotificationsModule,
    PlatformModule,
    WorkosModule,
  ],
  controllers: [HealthController, StreamController],
})
export class HealthModule {}
