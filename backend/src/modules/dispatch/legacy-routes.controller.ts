import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { DispatchService } from './dispatch.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { Route } from './entities/route.entity';

/**
 * Legacy compatibility controller for /api/routes.
 * This proxies to DispatchService with minimal logic to keep older clients working.
 */
@ApiTags('routes-legacy')
@Controller('routes')
export class LegacyRoutesController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Get()
  @ApiOperation({ summary: 'Legacy: Get all routes' })
  @ApiResponse({ status: 200, description: 'List of routes', type: [Route] })
  async findAll(): Promise<{ routes: Route[] }> {
    const routes = await this.dispatchService.findAll();
    return { routes };
  }

  @Post()
  @ApiOperation({ summary: 'Legacy: Create a route with optimization' })
  @ApiResponse({ status: 201, description: 'Route created successfully', type: Route })
  async create(@Body() createRouteDto: CreateRouteDto): Promise<{ route: Route }> {
    const route = await this.dispatchService.create(createRouteDto);
    return { route };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Legacy: Update a route' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Route updated', type: Route })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRouteDto: UpdateRouteDto,
  ): Promise<{ route: Route }> {
    const route = await this.dispatchService.update(id, updateRouteDto);
    return { route };
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Legacy: Assign a driver to a route' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Driver assigned to route', type: Route })
  async assignDriver(
    @Param('id', ParseUUIDPipe) routeId: string,
    @Body('driverId', ParseUUIDPipe) driverId: string,
  ): Promise<{ route: Route }> {
    const route = await this.dispatchService.assignDriver(routeId, driverId);
    return { route };
  }
}
