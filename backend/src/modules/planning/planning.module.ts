import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from '../dispatch/entities/route.entity';
import { RouteAssignment } from '../dispatch/entities/route-assignment.entity';
import { RouteRunStop } from '../dispatch/entities/route-run-stop.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Job } from '../jobs/entities/job.entity';
import { JobStop } from '../jobs/entities/job-stop.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Depot } from '../depots/entities/depot.entity';
import { RoutePlanGroup } from './entities/route-plan-group.entity';
import { RoutePlanStop } from './entities/route-plan-stop.entity';
import { RoutePlan } from './entities/route-plan.entity';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoutePlan,
      RoutePlanGroup,
      RoutePlanStop,
      Job,
      JobStop,
      Vehicle,
      Driver,
      Depot,
      Route,
      RouteRunStop,
      RouteAssignment,
    ]),
  ],
  controllers: [PlanningController],
  providers: [PlanningService],
  exports: [PlanningService],
})
export class PlanningModule {}
