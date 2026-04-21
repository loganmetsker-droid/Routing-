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
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { LegacyRoutesController } from './legacy-routes.controller';
import { RouteRunsController } from './route-runs.controller';
import { DispatchWorker } from './dispatch.worker';
import { DispatchGateway } from './dispatch.gateway';
import { DispatchRepository } from './repositories/dispatch.repository';
import { DispatchDomainService } from './services/dispatch-domain.service';
import { OptimizationJobLifecycleService } from './services/optimization-job-lifecycle.service';
import { RouteRunsService } from './route-runs.service';

const scheduleImports = process.env.ENABLE_SCHEDULER === '1' ? [ScheduleModule.forRoot()] : [];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Route,
      Vehicle,
      Job,
      Driver,
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
  controllers: [DispatchController, LegacyRoutesController, RouteRunsController],
  providers: [
    DispatchService,
    DispatchWorker,
    DispatchGateway,
    DispatchRepository,
    DispatchDomainService,
    OptimizationJobLifecycleService,
    RouteRunsService,
  ],
  exports: [DispatchService, DispatchGateway],
})
export class DispatchModule {}
