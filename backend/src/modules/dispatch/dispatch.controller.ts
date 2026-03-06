import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
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
import { Route, RouteStatus } from './entities/route.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { CreateGlobalRouteDto } from './dto/create-global-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('dispatch')
@Controller('dispatch')
@ApiBearerAuth()
@Public()
export class DispatchController {
  constructor(
    private readonly dispatchService: DispatchService,
    private readonly dispatchWorker: DispatchWorker,
  ) { }

  @Post('routes/global')
  @ApiOperation({ summary: 'Create and optimize global multi-vehicle routes' })
  @ApiResponse({
    status: 201,
    description: 'Routes created successfully',
    type: [Route],
  })
  createGlobal(@Body() createGlobalRouteDto: CreateGlobalRouteDto): Promise<Route[]> {
    return this.dispatchService.createGlobalRoutes(createGlobalRouteDto);
  }

  @Post('routes')
  @ApiOperation({ summary: 'Create and optimize a new route' })
  @ApiResponse({
    status: 201,
    description: 'Route created successfully',
    type: Route,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Vehicle or jobs not found' })
  create(@Body() createRouteDto: CreateRouteDto): Promise<Route> {
    return this.dispatchService.create(createRouteDto);
  }

  @Get('routes')
  @ApiOperation({ summary: 'Get all routes' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: RouteStatus,
    description: 'Filter by route status',
  })
  @ApiResponse({ status: 200, description: 'List of routes', type: [Route] })
  findAll(@Query('status') status?: RouteStatus): Promise<Route[]> {
    return this.dispatchService.findAll(status);
  }

  @Get('routes/statistics')
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
  getStatistics() {
    return this.dispatchService.getStatistics();
  }

  @Get('routes/:id')
  @ApiOperation({ summary: 'Get a route by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Route found', type: Route })
  @ApiResponse({ status: 404, description: 'Route not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Route> {
    return this.dispatchService.findOne(id);
  }

  @Get('vehicles/:vehicleId/routes')
  @ApiOperation({ summary: 'Get all routes for a vehicle' })
  @ApiParam({ name: 'vehicleId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'List of routes for vehicle',
    type: [Route],
  })
  findByVehicle(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  ): Promise<Route[]> {
    return this.dispatchService.findByVehicle(vehicleId);
  }

  @Put('routes/:id')
  @ApiOperation({ summary: 'Update a route' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Route updated', type: Route })
  @ApiResponse({ status: 404, description: 'Route not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRouteDto: UpdateRouteDto,
  ): Promise<Route> {
    return this.dispatchService.update(id, updateRouteDto);
  }

  @Patch('routes/:id')
  @ApiOperation({ summary: 'Partially update a route' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Route updated', type: Route })
  @ApiResponse({ status: 404, description: 'Route not found' })
  partialUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRouteDto: UpdateRouteDto,
  ): Promise<Route> {
    return this.dispatchService.update(id, updateRouteDto);
  }

  @Post('routes/:id/assign')
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
    @Param('id', ParseUUIDPipe) routeId: string,
    @Body('driverId', ParseUUIDPipe) driverId: string,
  ): Promise<Route> {
    return this.dispatchService.update(routeId, { driverId });
  }

  @Patch('routes/:id/start')
  @ApiOperation({ summary: 'Start a route (sets vehicle to in_route)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Route started', type: Route })
  @ApiResponse({ status: 400, description: 'Route cannot be started' })
  startRoute(@Param('id', ParseUUIDPipe) id: string): Promise<Route> {
    return this.dispatchService.startRoute(id);
  }

  @Patch('routes/:id/complete')
  @ApiOperation({ summary: 'Complete a route' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Route completed', type: Route })
  @ApiResponse({ status: 400, description: 'Route cannot be completed' })
  completeRoute(@Param('id', ParseUUIDPipe) id: string): Promise<Route> {
    return this.dispatchService.completeRoute(id);
  }

  @Patch('routes/:id/cancel')
  @ApiOperation({ summary: 'Cancel a route' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Route cancelled', type: Route })
  cancelRoute(@Param('id', ParseUUIDPipe) id: string): Promise<Route> {
    return this.dispatchService.cancelRoute(id);
  }

  @Patch('routes/:id/reorder')
  @UseGuards(RolesGuard)
  @Roles('DISPATCHER', 'ADMIN')
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body('newJobOrder') newJobOrder: string[],
  ): Promise<Route> {
    return this.dispatchService.reorderStops(id, newJobOrder);
  }

  @Post('auto-dispatch')
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
