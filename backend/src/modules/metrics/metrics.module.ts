import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Telemetry } from '../tracking/entities/telemetry.entity';
import { Shift } from '../drivers/entities/shift.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Route } from '../dispatch/entities/route.entity';
import { RouteRunStop } from '../dispatch/entities/route-run-stop.entity';
import { DispatchException } from '../dispatch/entities/dispatch-exception.entity';
import { ProofArtifact } from '../dispatch/entities/proof-artifact.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehicle,
      Telemetry,
      Shift,
      Driver,
      Route,
      RouteRunStop,
      DispatchException,
      ProofArtifact,
    ]),
  ],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
