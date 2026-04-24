import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { Route } from './entities/route.entity';
import { RerouteRequest } from './entities/reroute-request.entity';
import { DispatchEvent } from './entities/dispatch-event.entity';
import { RouteVersion } from './entities/route-version.entity';
import { RouteRunStop } from './entities/route-run-stop.entity';
import { RouteAssignment } from './entities/route-assignment.entity';
import { StopEvent } from './entities/stop-event.entity';
import { DispatchException } from './entities/dispatch-exception.entity';
import { ProofArtifact } from './entities/proof-artifact.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Job } from '../jobs/entities/job.entity';
import { Telemetry } from '../tracking/entities/telemetry.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { RouteRunsController } from './route-runs.controller';
import { DispatchWorker } from './dispatch.worker';
import { DispatchGateway } from './dispatch.gateway';
import { DispatchRepository } from './repositories/dispatch.repository';
import { DispatchDomainService } from './services/dispatch-domain.service';
import { DispatchEventsService } from './services/dispatch-events.service';
import { DispatchOptimizerStateService } from './services/dispatch-optimizer-state.service';
import { DispatchPresentationService } from './services/dispatch-presentation.service';
import { OptimizationJobLifecycleService } from './services/optimization-job-lifecycle.service';
import { RouteVersioningService } from './services/route-versioning.service';
import { RouteRunsService } from './route-runs.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformModule } from '../platform/platform.module';

const scheduleImports = process.env.ENABLE_SCHEDULER === '1' ? [ScheduleModule.forRoot()] : [];

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    PlatformModule,
    TypeOrmModule.forFeature([
      Route,
      Vehicle,
      Job,
      Driver,
      Telemetry,
      Organization,
      RerouteRequest,
      DispatchEvent,
      RouteVersion,
      RouteRunStop,
      RouteAssignment,
      StopEvent,
      DispatchException,
      ProofArtifact,
    ]),
    HttpModule.register({
      timeout: 30000, // 30 second timeout for routing-service calls
      maxRedirects: 5,
    }),
    ...scheduleImports,
  ],
  controllers: [DispatchController, RouteRunsController],
  providers: [
    DispatchService,
    DispatchWorker,
    DispatchGateway,
    DispatchRepository,
    DispatchDomainService,
    DispatchEventsService,
    DispatchOptimizerStateService,
    DispatchPresentationService,
    OptimizationJobLifecycleService,
    RouteVersioningService,
    RouteRunsService,
  ],
  exports: [DispatchService, DispatchGateway],
})
export class DispatchModule {}
