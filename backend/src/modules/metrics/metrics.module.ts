import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Telemetry } from '../tracking/entities/telemetry.entity';
import { Shift } from '../drivers/entities/shift.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, Telemetry, Shift])],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
