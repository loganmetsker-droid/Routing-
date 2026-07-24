import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Telemetry } from './entities/telemetry.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { TrackingService } from './tracking.service';
import { TrackingGateway } from './tracking.gateway';
import { TrackingController } from './tracking.controller';
import { AuthModule } from '../auth/auth.module';
import { AuthSession } from '../auth/entities/auth-session.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Telemetry, Vehicle, Driver, AuthSession]),
  ],
  controllers: [TrackingController],
  providers: [TrackingService, TrackingGateway],
  exports: [TrackingService, TrackingGateway],
})
export class TrackingModule {}
