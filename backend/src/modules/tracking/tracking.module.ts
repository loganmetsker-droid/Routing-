import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Telemetry } from './entities/telemetry.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { TrackingService } from './tracking.service';
import { TrackingGateway } from './tracking.gateway';
import { TrackingController } from './tracking.controller';
import { AuthModule } from '../auth/auth.module';

const scheduleImports = process.env.ENABLE_SCHEDULER === '1' ? [ScheduleModule.forRoot()] : [];

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Telemetry, Vehicle]),
    ...scheduleImports,
  ],
  controllers: [TrackingController],
  providers: [TrackingService, TrackingGateway],
  exports: [TrackingService, TrackingGateway],
})
export class TrackingModule {}
