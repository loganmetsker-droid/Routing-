import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Telemetry } from './entities/telemetry.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { TrackingService } from './tracking.service';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Telemetry, Vehicle]),
    ScheduleModule.forRoot(),
  ],
  providers: [TrackingService, TrackingGateway],
  exports: [TrackingService, TrackingGateway],
})
export class TrackingModule {}
