import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { GenerateRoutePlanDto } from './dto/generate-route-plan.dto';
import { UpdateRoutePlanGroupDto } from './dto/update-route-plan-group.dto';
import { UpdateRoutePlanStopDto } from './dto/update-route-plan-stop.dto';
import { AcceptPublishRiskDto } from './dto/accept-publish-risk.dto';
import { InsertRoutePlanJobDto } from './dto/insert-route-plan-job.dto';
import { BatchMoveRoutePlanStopsDto } from './dto/batch-move-route-plan-stops.dto';
import { PlanningService } from './planning.service';

type AuthenticatedRequest = {
  user?: {
    userId?: string;
    email?: string;
    organizationId?: string;
    roles?: string[];
  };
};

@ApiTags('planner', 'route-plans')
@Controller()
@ApiBearerAuth('JWT-auth')
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Get('planner')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  getPlanner(@Req() req: AuthenticatedRequest, @Query('serviceDate') serviceDate: string) {
    return this.planning.getPlannerView(serviceDate, req.user);
  }

  @Post('route-plans/generate-draft')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  generateDraft(@Req() req: AuthenticatedRequest, @Body() dto: GenerateRoutePlanDto) {
    return this.planning.generateDraft(dto, req.user);
  }

  @Get('route-plans/:id')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  getRoutePlan(@Req() req: AuthenticatedRequest, @Param('id') routePlanId: string) {
    return this.planning.getRoutePlan(routePlanId, req.user);
  }

  @Get('route-plans/:id/driver-familiarity')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  getDriverFamiliarity(
    @Req() req: AuthenticatedRequest,
    @Param('id') routePlanId: string,
  ) {
    return this.planning.getDriverFamiliarity(routePlanId, req.user);
  }

  @Post('route-plans/:id/reoptimize')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  reoptimize(@Req() req: AuthenticatedRequest, @Param('id') routePlanId: string) {
    return this.planning.reoptimize(routePlanId, req.user);
  }

  @Get('route-plans/:id/publish-readiness')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  getPublishReadiness(
    @Req() req: AuthenticatedRequest,
    @Param('id') routePlanId: string,
  ) {
    return this.planning.getPublishReadiness(routePlanId, req.user);
  }

  @Post('route-plans/:id/publish-decisions/accept-risk')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  acceptPublishRisk(
    @Req() req: AuthenticatedRequest,
    @Param('id') routePlanId: string,
    @Body() dto: AcceptPublishRiskDto,
  ) {
    return this.planning.acceptPublishRisk(routePlanId, dto, req.user);
  }

  @Patch('route-plans/:id/groups/:groupId')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  updateGroup(
    @Req() req: AuthenticatedRequest,
    @Param('id') routePlanId: string,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateRoutePlanGroupDto,
  ) {
    return this.planning.updateGroup(routePlanId, groupId, dto, req.user);
  }

  @Patch('route-plans/:id/stops/:stopId')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  updateStop(
    @Req() req: AuthenticatedRequest,
    @Param('id') routePlanId: string,
    @Param('stopId') stopId: string,
    @Body() dto: UpdateRoutePlanStopDto,
  ) {
    return this.planning.updateStop(routePlanId, stopId, dto, req.user);
  }

  @Post('route-plans/:id/stops/batch-move')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  batchMoveStops(
    @Req() req: AuthenticatedRequest,
    @Param('id') routePlanId: string,
    @Body() dto: BatchMoveRoutePlanStopsDto,
  ) {
    return this.planning.batchMoveStops(routePlanId, dto, req.user);
  }

  @Post('route-plans/:id/groups/:groupId/insert-job')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  insertJob(
    @Req() req: AuthenticatedRequest,
    @Param('id') routePlanId: string,
    @Param('groupId') groupId: string,
    @Body() dto: InsertRoutePlanJobDto,
  ) {
    return this.planning.insertJob(routePlanId, groupId, dto, req.user);
  }

  @Post('route-plans/:id/publish')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  publish(@Req() req: AuthenticatedRequest, @Param('id') routePlanId: string) {
    return this.planning.publish(routePlanId, req.user);
  }
}
