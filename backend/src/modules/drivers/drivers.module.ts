import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from './entities/driver.entity';
import { Shift } from './entities/shift.entity';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { DriversResolver } from './drivers.resolver';
import { Vehicle } from '../vehicles/entities/vehicle.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Driver, Shift, Vehicle])],
  controllers: [DriversController],
  providers: [DriversService, DriversResolver],
  exports: [DriversService],
})
export class DriversModule {}
