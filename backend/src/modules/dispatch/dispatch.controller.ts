import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { DispatchService } from './dispatch.service';
import { DispatchWorker } from './dispatch.worker';
import { AuditService } from '../../common/audit/audit.service';
import { DomainEvents } from '../../common/events/event-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { Route, RouteStatus } from './entities/route.entity';
import { RouteVersion } from './entities/route-version.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { CreateGlobalRouteDto } from './dto/create-global-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { OptimizerEvent, OptimizerHealth } from './dto/routing-service.dto';
import {
  ApplyRerouteDto,
  RequestRerouteDto,
  ReroutePreviewDto,
  ReviewRerouteDto,
} from './dto/reroute.dto';
import { RerouteRequest } from './entities/reroute-request.entity';

type AuthenticatedRequest = {
  user?: {
    userId?: string;
    email?: string;
    organizationId?: string;
    role?: string;
    roles?: string[];
  };
};

@ApiTags('dispatch')
@Controller('dispatch')
@ApiBearerAuth()
export class DispatchController {
  constructor(
    private readonly dispatchService: DispatchService,
    private readonly dispatchWorker: DispatchWorker,
    private readonly auditService: AuditService,
  ) { }

  @Post('routes/global')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Create and optimize global multi-vehicle routes' })
  @ApiResponse({
    status: 201,
    description: 'Routes created successfully',
    type: [Route],
  })
  async createGlobal(
    @Req() req: AuthenticatedRequest,
    @Body() createGlobalRouteDto: CreateGlobalRouteDto,
  ): Promise<{
    routes: Route[];
    optimizationStatus: string;
    dataQuality: string;
    droppedJobIds: string[];
    warnings: string[];
    optimizerHealth: OptimizerHealth;
  }> {
    const result = await this.dispatchService.createGlobalRoutes(
      createGlobalRouteDto,
      req.user,
    );
    return {
      ...result,
      routes: result.routes.map((route) => this.dispatchService.presentRoute(route)),
    } as any;
  }

  @Post('routes')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Create and optimize a new route' })
  @ApiResponse({
    status: 201,
    description: 'Route created successfully',
    type: Route,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Vehicle or jobs not found' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() createRouteDto: CreateRouteDto,
  ): Promise<{ route: Route; optimizerHealth: OptimizerHealth }> {
    const route = await this.dispatchService.create(createRouteDto, req.user);
    this.auditService.record({
      actorId: req.user?.userId || 'unknown',
      actorType: 'user',
      entityType: 'route',
      entityId: route.id,
      action: DomainEvents.route.created,
      source: 'user',
      newValue: { vehicleId: route.vehicleId, status: route.status },
    });
    return {
      route: this.dispatchService.presentRoute(route) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    };
  }

  @Get('routes')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  @ApiOperation({ summary: 'Get all routes' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: RouteStatus,
    description: 'Filter by route status',
  })
  @ApiResponse({ status: 200, description: 'List of routes', type: [Route] })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: RouteStatus,
  ): Promise<{ routes: Route[]; optimizerHealth: OptimizerHealth }> {
    const routes = await this.dispatchService.findAll(status, req.user);
    return {
      routes: routes.map((route) => this.dispatchService.presentRoute(route)) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    };
  }

  @Get('routes/statistics')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  @ApiOperation({ summary: 'Get route statistics' })
  @ApiResponse({
    status: 200,
    description: 'Route statistics',
    schema: {
      type: 'object',
      properties: {
        byStatus: {
          type: 'object',
          additionalProperties: { type: 'number' },
        },
        total: { type: 'number' },
      },
    },
  })
  getStatistics(@Req() req: AuthenticatedRequest) {
    return this.dispatchService.getStatistics(req.user);
  }

  @Get('routes/:id')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  @ApiOperation({ summary: 'Get a route by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Route found', type: Route })
  @ApiResponse({ status: 404, description: 'Route not found' })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ route: Route; optimizerHealth: OptimizerHealth }> {
    const route = await this.dispatchService.findOne(id, req.user);
    return {
      route: this.dispatchService.presentRoute(route) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    };
  }

  @Get('vehicles/:vehicleId/routes')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  @ApiOperation({ summary: 'Get all routes for a vehicle' })
  @ApiParam({ name: 'vehicleId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'List of routes for vehicle',
    type: [Route],
  })
  findByVehicle(
    @Req() req: AuthenticatedRequest,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  ): Promise<{ routes: Route[]; optimizerHealth: OptimizerHealth }> {
    return this.dispatchService.findByVehicle(vehicleId, req.user).then((routes) => ({
      routes: routes.map((route) => this.dispatchService.presentRoute(route)) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    }));
  }

  @Put('routes/:id')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Update a route' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Route updated', type: Route })
  @ApiResponse({ status: 404, description: 'Route not found' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRouteDto: UpdateRouteDto,
  ): Promise<{ route: Route; optimizerHealth: OptimizerHealth }> {
    return this.dispatchService.update(id, updateRouteDto, req.user).then((route) => ({
      route: this.dispatchService.presentRoute(route) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    }));
  }

  @Patch('routes/:id')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Partially update a route' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Route updated', type: Route })
  @ApiResponse({ status: 404, description: 'Route not found' })
  partialUpdate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRouteDto: UpdateRouteDto,
  ): Promise<{ route: Route; optimizerHealth: OptimizerHealth }> {
    this.auditService.record({
      actorId: req.user?.userId || 'unknown',
      actorType: 'user',
      entityType: 'route',
      entityId: id,
      action: DomainEvents.route.updated,
      source: 'user',
      newValue: updateRouteDto as Record<string, unknown>,
    });
    return this.dispatchService.update(id, updateRouteDto, req.user).then((route) => ({
      route: this.dispatchService.presentRoute(route) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    }));
  }

  @Post('routes/:id/assign')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Assign a driver to a route' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        driverId: {
          type: 'string',
          format: 'uuid',
          description: 'ID of the driver to assign',
        },
      },
      required: ['driverId'],
    },
  })
  @ApiResponse({ status: 200, description: 'Driver assigned to route', type: Route })
  @ApiResponse({ status: 404, description: 'Route or driver not found' })
  async assignDriver(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) routeId: string,
    @Body('driverId', ParseUUIDPipe) driverId: string,
  ): Promise<{ route: Route; optimizerHealth: OptimizerHealth }> {
    const route = await this.dispatchService.assignDriver(routeId, driverId, req.user);
    this.auditService.record({
      actorId: req.user?.userId || 'unknown',
      actorType: 'user',
      entityType: 'assignment',
      entityId: routeId,
      action: DomainEvents.dispatch.assignmentCreated,
      source: 'user',
      newValue: { routeId, driverId },
    });
    return {
      route: this.dispatchService.presentRoute(route) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    };
  }

  @Patch('routes/:id/start')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  @ApiOperation({ summary: 'Start a route (sets vehicle to in_route)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Route started', type: Route })
  @ApiResponse({ status: 400, description: 'Route cannot be started' })
  startRoute(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ route: Route; optimizerHealth: OptimizerHealth }> {
    return this.dispatchService.startRoute(id, req.user).then((route) => ({
      route: this.dispatchService.presentRoute(route) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    }));
  }

  @Patch('routes/:id/complete')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  @ApiOperation({ summary: 'Complete a route' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Route completed', type: Route })
  @ApiResponse({ status: 400, description: 'Route cannot be completed' })
  completeRoute(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ route: Route; optimizerHealth: OptimizerHealth }> {
    return this.dispatchService.completeRoute(id, req.user).then((route) => ({
      route: this.dispatchService.presentRoute(route) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    }));
  }

  @Patch('routes/:id/cancel')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Cancel a route' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Route cancelled', type: Route })
  cancelRoute(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ route: Route; optimizerHealth: OptimizerHealth }> {
    return this.dispatchService.cancelRoute(id, req.user).then((route) => ({
      route: this.dispatchService.presentRoute(route) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    }));
  }

  @Patch('routes/:id/reorder')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({
    summary: 'Reorder stops in a route (Dispatcher only)',
    description:
      'Reorder job stops and recalculate polyline, distance, and ETA',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        newJobOrder: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          description: 'Array of job IDs in new order',
        },
      },
      required: ['newJobOrder'],
    },
  })
  @ApiResponse({ status: 200, description: 'Route stops reordered', type: Route })
  @ApiResponse({ status: 400, description: 'Invalid job order' })
  @ApiResponse({ status: 403, description: 'Forbidden - Dispatcher role required' })
  @ApiResponse({ status: 404, description: 'Route not found' })
  reorderStops(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('newJobOrder') newJobOrder: string[],
  ): Promise<{ route: Route; optimizerHealth: OptimizerHealth }> {
    return this.dispatchService.reorderStops(id, newJobOrder, req.user).then((route) => ({
      route: this.dispatchService.presentRoute(route) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    }));
  }

  @Get('optimizer/health')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  @ApiOperation({ summary: 'Get optimization service health and circuit-breaker status' })
  @ApiResponse({ status: 200, description: 'Optimizer health status' })
  getOptimizerHealth(): OptimizerHealth {
    return this.dispatchService.getOptimizerHealth();
  }

  @Get('optimizer/events')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  @ApiOperation({ summary: 'Get optimizer health/fallback event history (in-memory model)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Optimizer events' })
  async getOptimizerEvents(@Query('limit') limit?: string): Promise<{ events: OptimizerEvent[] }> {
    const parsedLimit = limit ? Number(limit) : 50;
    return { events: await this.dispatchService.getOptimizerEvents(parsedLimit) };
  }

  @Get('optimizer/jobs')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  @ApiOperation({ summary: 'Get in-memory optimization job lifecycle records' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Optimization job lifecycle records' })
  getOptimizationJobs(@Query('limit') limit?: string): { jobs: any[] } {
    const parsedLimit = limit ? Number(limit) : 100;
    return { jobs: this.dispatchService.getOptimizationJobs(parsedLimit) };
  }

  @Get('timeline')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  @ApiOperation({ summary: 'Get dispatch timeline events (optimizer/reroute/workflow)' })
  @ApiQuery({ name: 'routeId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'reasonCode', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'actor', required: false, type: String })
  @ApiQuery({ name: 'source', required: false, type: String })
  @ApiQuery({ name: 'before', required: false, type: String })
  @ApiQuery({ name: 'packId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Dispatch timeline events' })
  async getDispatchTimeline(
    @Query('routeId') routeId?: string,
    @Query('limit') limit?: string,
    @Query('reasonCode') reasonCode?: string,
    @Query('action') action?: string,
    @Query('actor') actor?: string,
    @Query('source') source?: string,
    @Query('before') before?: string,
    @Query('packId') packId?: string,
  ): Promise<{ events: any[] }> {
    const parsedLimit = limit ? Number(limit) : 100;
    return {
      events: await this.dispatchService.getDispatchTimeline(routeId, parsedLimit, {
        reasonCode,
        action,
        actor,
        source: source as any,
        before,
        packId,
      }),
    };
  }

  @Post('routes/:id/reroute/request')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER')
  @ApiOperation({ summary: 'Request a reroute for a route (exception-driven)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Reroute request created' })
  async requestReroute(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) routeId: string,
    @Body() dto: RequestRerouteDto,
  ): Promise<{ rerouteRequest: RerouteRequest; route: Route; optimizerHealth: OptimizerHealth }> {
    const rerouteRequest = await this.dispatchService.requestReroute(
      routeId,
      dto,
      req.user,
    );
    this.auditService.record({
      actorId: req.user?.userId || dto.requesterId || 'system',
      actorType: 'user',
      entityType: 'exception',
      entityId: rerouteRequest.id,
      action: DomainEvents.exception.created,
      source: 'user',
      newValue: { routeId, action: dto.action, exceptionCategory: dto.exceptionCategory },
    });
    const route = await this.dispatchService.findOne(routeId, req.user);
    return {
      rerouteRequest,
      route: this.dispatchService.presentRoute(route) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    };
  }

  @Post('routes/:id/reroute/:requestId/approve')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Approve a pending reroute request' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'requestId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Reroute request approved' })
  async approveReroute(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) routeId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: ReviewRerouteDto,
  ): Promise<{ rerouteRequest: RerouteRequest; route: Route; optimizerHealth: OptimizerHealth }> {
    const rerouteRequest = await this.dispatchService.approveReroute(
      routeId,
      requestId,
      dto,
      req.user,
    );
    this.auditService.record({
      actorId: req.user?.userId || dto.reviewerId || 'system',
      actorType: 'user',
      entityType: 'exception',
      entityId: rerouteRequest.id,
      action: DomainEvents.exception.acknowledged,
      source: 'user',
      newValue: { routeId, status: rerouteRequest.status },
    });
    const route = await this.dispatchService.findOne(routeId, req.user);
    return {
      rerouteRequest,
      route: this.dispatchService.presentRoute(route) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    };
  }

  @Post('routes/:id/reroute/:requestId/reject')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Reject a pending reroute request' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'requestId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Reroute request rejected' })
  async rejectReroute(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) routeId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: ReviewRerouteDto,
  ): Promise<{ rerouteRequest: RerouteRequest; route: Route; optimizerHealth: OptimizerHealth }> {
    const rerouteRequest = await this.dispatchService.rejectReroute(
      routeId,
      requestId,
      dto,
      req.user,
    );
    this.auditService.record({
      actorId: req.user?.userId || dto.reviewerId || 'system',
      actorType: 'user',
      entityType: 'exception',
      entityId: rerouteRequest.id,
      action: DomainEvents.exception.dismissed,
      source: 'user',
      newValue: { routeId, status: rerouteRequest.status },
    });
    const route = await this.dispatchService.findOne(routeId, req.user);
    return {
      rerouteRequest,
      route: this.dispatchService.presentRoute(route) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    };
  }

  @Post('routes/:id/reroute/:requestId/apply')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Apply an approved reroute request' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'requestId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Reroute request applied' })
  async applyReroute(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) routeId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: ApplyRerouteDto,
  ): Promise<{ rerouteRequest: RerouteRequest; route: Route; optimizerHealth: OptimizerHealth }> {
    const rerouteRequest = await this.dispatchService.applyReroute(
      routeId,
      requestId,
      dto,
      req.user,
    );
    this.auditService.record({
      actorId: req.user?.userId || dto.appliedBy || 'system',
      actorType: 'user',
      entityType: 'exception',
      entityId: rerouteRequest.id,
      action: DomainEvents.exception.resolved,
      source: 'user',
      newValue: { routeId, status: rerouteRequest.status, overrideRequested: dto.overrideRequested || false },
    });
    const route = await this.dispatchService.findOne(routeId, req.user);
    return {
      rerouteRequest,
      route: this.dispatchService.presentRoute(route) as any,
      optimizerHealth: this.dispatchService.getOptimizerHealth(),
    };
  }

  @Get('routes/:id/reroute/history')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  @ApiOperation({ summary: 'Get reroute audit history for a route' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Route reroute history' })
  async getRerouteHistory(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) routeId: string,
  ): Promise<{ rerouteRequests: RerouteRequest[] }> {
    const rerouteRequests = await this.dispatchService.getRerouteHistory(routeId, req.user);
    return { rerouteRequests };
  }

  @Post('routes/:id/reroute/preview')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Preview reroute impact without applying changes' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Reroute impact preview' })
  async previewReroute(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) routeId: string,
    @Body() dto: ReroutePreviewDto,
  ): Promise<{ preview: any }> {
    const preview = await this.dispatchService.previewReroute(
      routeId,
      dto.action as any,
      dto.payload || {},
      req.user,
    );
    return { preview };
  }

  @Get('routes/:id/versions')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  @ApiOperation({ summary: 'List route versions for a route' })
  async listRouteVersions(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) routeId: string,
  ): Promise<{ versions: RouteVersion[] }> {
    const versions = await this.dispatchService.listRouteVersions(routeId, req.user);
    return { versions };
  }

  @Post('routes/:id/versions/snapshot')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Snapshot the current route into a new draft version' })
  async snapshotRouteVersion(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) routeId: string,
  ): Promise<{ version: RouteVersion }> {
    const version = await this.dispatchService.createRouteVersionSnapshot(
      routeId,
      req.user,
    );
    return { version };
  }

  @Post('routes/:id/versions/:versionId/review')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Mark a route version as reviewed' })
  async reviewRouteVersion(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) routeId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ): Promise<{ version: RouteVersion }> {
    const version = await this.dispatchService.reviewRouteVersion(
      routeId,
      versionId,
      req.user,
    );
    return { version };
  }

  @Post('routes/:id/versions/:versionId/approve')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Approve a reviewed route version' })
  async approveRouteVersion(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) routeId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ): Promise<{ version: RouteVersion }> {
    const version = await this.dispatchService.approveRouteVersion(
      routeId,
      versionId,
      req.user,
    );
    return { version };
  }

  @Post('routes/:id/versions/:versionId/publish')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Publish an approved route version' })
  async publishRouteVersion(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) routeId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ): Promise<{ version: RouteVersion }> {
    const version = await this.dispatchService.publishRouteVersion(
      routeId,
      versionId,
      req.user,
    );
    return { version };
  }

  @Post('auto-dispatch')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually trigger auto-dispatch (for testing)',
    description:
      'Manually runs the auto-dispatch worker that normally runs every minute. Returns detailed results.',
  })
  @ApiResponse({
    status: 200,
    description: 'Auto-dispatch completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        error: { type: 'string' },
        routesCreated: { type: 'number' },
        routeIds: { type: 'array', items: { type: 'string' } },
        failedVehicles: { type: 'array' },
        durationMs: { type: 'number' },
        pendingJobCount: { type: 'number' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'Auto-dispatch failed' })
  async manualDispatch() {
    const result = await this.dispatchWorker.manualDispatch();
    return {
      ...result,
      timestamp: new Date(),
    };
  }
}
