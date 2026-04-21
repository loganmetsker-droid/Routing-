import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RouteRunsService } from './route-runs.service';

type AuthenticatedRequest = { user?: { userId?: string; organizationId?: string; roles?: string[] } };

@ApiTags('dispatch', 'route-runs', 'exceptions')
@Controller()
@ApiBearerAuth('JWT-auth')
export class RouteRunsController {
  constructor(private readonly routeRuns: RouteRunsService) {}

  @Get('dispatch/board')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  board(@Req() req: AuthenticatedRequest) { return this.routeRuns.board(req.user?.organizationId); }

  @Get('route-runs')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER', 'DRIVER')
  list(@Req() req: AuthenticatedRequest) { return this.routeRuns.list(req.user?.organizationId); }

  @Get('route-runs/:id')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER', 'DRIVER')
  detail(@Req() req: AuthenticatedRequest, @Param('id') routeId: string) { return this.routeRuns.detail(routeId, req.user?.organizationId); }

  @Post('route-runs/:id/dispatch')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  dispatch(@Req() req: AuthenticatedRequest, @Param('id') routeId: string) { return this.routeRuns.dispatchRoute(routeId, req.user); }

  @Post('route-runs/:id/start')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  start(@Req() req: AuthenticatedRequest, @Param('id') routeId: string) { return this.routeRuns.startRoute(routeId, req.user); }

  @Post('route-runs/:id/complete')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  complete(@Req() req: AuthenticatedRequest, @Param('id') routeId: string) { return this.routeRuns.completeRoute(routeId, req.user); }

  @Post('route-runs/:id/reassign')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  reassign(@Req() req: AuthenticatedRequest, @Param('id') routeId: string, @Body() body: { driverId?: string; vehicleId?: string; reason?: string }) {
    return this.routeRuns.reassign(routeId, body, req.user);
  }

  @Get('route-run-stops/:id/timeline')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER', 'DRIVER')
  timeline(@Req() req: AuthenticatedRequest, @Param('id') stopId: string) { return this.routeRuns.getStopTimeline(stopId, req.user); }

  @Get('route-run-stops/:id/proofs')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER', 'DRIVER')
  proofs(@Req() req: AuthenticatedRequest, @Param('id') stopId: string) { return this.routeRuns.getStopProofs(stopId, req.user); }

  @Post('route-run-stops/:id/mark-arrived')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  markArrived(@Req() req: AuthenticatedRequest, @Param('id') stopId: string) { return this.routeRuns.markArrived(stopId, req.user); }

  @Post('route-run-stops/:id/serviced')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  serviced(@Req() req: AuthenticatedRequest, @Param('id') stopId: string) { return this.routeRuns.markServiced(stopId, req.user); }

  @Post('route-run-stops/:id/failed')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  failed(@Req() req: AuthenticatedRequest, @Param('id') stopId: string, @Body() body: { reason: string }) { return this.routeRuns.failStop(stopId, body.reason, req.user); }

  @Post('route-run-stops/:id/reschedule')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  reschedule(@Req() req: AuthenticatedRequest, @Param('id') stopId: string, @Body() body: { reason: string }) { return this.routeRuns.rescheduleStop(stopId, body.reason, req.user); }

  @Post('route-run-stops/:id/proof')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  proof(@Req() req: AuthenticatedRequest, @Param('id') stopId: string, @Body() body: { type: string; uri: string; metadata?: Record<string, unknown> }) { return this.routeRuns.addProof(stopId, body, req.user); }

  @Post('route-run-stops/:id/note')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  note(@Req() req: AuthenticatedRequest, @Param('id') stopId: string, @Body() body: { note: string }) { return this.routeRuns.addNote(stopId, body.note, req.user); }

  @Get('exceptions')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  exceptions(@Req() req: AuthenticatedRequest) { return this.routeRuns.listExceptions(req.user?.organizationId); }

  @Patch('exceptions/:id')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  updateException(@Req() req: AuthenticatedRequest, @Param('id') exceptionId: string, @Body() body: { status?: 'ACKNOWLEDGED' | 'RESOLVED' }) {
    return this.routeRuns.resolveException(exceptionId, req.user, body.status || 'RESOLVED');
  }
}
