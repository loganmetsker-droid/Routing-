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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { DispatchService } from './dispatch.service';
import { DispatchWorker } from './dispatch.worker';
import { Route, RouteStatus } from './entities/route.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('dispatch')
@Controller('api/dispatch')
@ApiBearerAuth()
@Public()
export class DispatchController {
  constructor(
    private readonly dispatchService: DispatchService,
    private readonly dispatchWorker: DispatchWorker,
  ) {}

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

  @Post('auto-dispatch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually trigger auto-dispatch (for testing)',
    description:
      'Manually runs the auto-dispatch worker that normally runs every minute',
  })
  @ApiResponse({ status: 200, description: 'Auto-dispatch triggered' })
  async manualDispatch() {
    await this.dispatchWorker.manualDispatch();
    return {
      message: 'Auto-dispatch triggered successfully',
      timestamp: new Date(),
    };
  }
}
