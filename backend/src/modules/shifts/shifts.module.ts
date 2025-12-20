import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Shift } from '../drivers/entities/shift.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { ShiftCompletionCron } from './shift-completion.cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shift, Driver, Vehicle]),
    ScheduleModule.forRoot(),
  ],
  controllers: [ShiftsController],
  providers: [ShiftsService, ShiftCompletionCron],
  exports: [ShiftsService],
})
export class ShiftsModule {}
