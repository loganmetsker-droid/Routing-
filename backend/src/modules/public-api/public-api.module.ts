import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/entities/job.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Route } from '../dispatch/entities/route.entity';
import { RouteRunStop } from '../dispatch/entities/route-run-stop.entity';
import { DispatchException } from '../dispatch/entities/dispatch-exception.entity';
import { ProofArtifact } from '../dispatch/entities/proof-artifact.entity';
import { Telemetry } from '../tracking/entities/telemetry.entity';
import { PlatformModule } from '../platform/platform.module';
import { PublicApiController } from './public-api.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Job,
      Customer,
      Driver,
      Vehicle,
      Route,
      RouteRunStop,
      DispatchException,
      ProofArtifact,
      Telemetry,
    ]),
    PlatformModule,
  ],
  controllers: [PublicApiController],
})
export class PublicApiModule {}
