import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { Route } from './entities/route.entity';
import { RerouteRequest } from './entities/reroute-request.entity';
import { DispatchEvent } from './entities/dispatch-event.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Job } from '../jobs/entities/job.entity';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { LegacyRoutesController } from './legacy-routes.controller';
import { DispatchWorker } from './dispatch.worker';
import { DispatchGateway } from './dispatch.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Route, Vehicle, Job, Driver, RerouteRequest, DispatchEvent]),
    HttpModule.register({
      timeout: 30000, // 30 second timeout for routing-service calls
      maxRedirects: 5,
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [DispatchController, LegacyRoutesController],
  providers: [DispatchService, DispatchWorker, DispatchGateway],
  exports: [DispatchService, DispatchGateway],
})
export class DispatchModule {}
