import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { Vehicle } from './entities/vehicle.entity';

@ApiTags('vehicles')
@ApiBearerAuth('JWT-auth')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new vehicle' })
  @ApiResponse({
    status: 201,
    description: 'The vehicle has been successfully created',
    type: Vehicle,
  })
  @ApiResponse({
    status: 409,
    description: 'Vehicle with this license plate already exists',
  })
  async create(@Body() createVehicleDto: CreateVehicleDto): Promise<{ vehicle: Vehicle }> {
    const vehicle = await this.vehiclesService.create(createVehicleDto);
    return { vehicle };
  }

  @Get()
  @ApiOperation({ summary: 'Get all vehicles' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by vehicle status',
  })
  @ApiResponse({
    status: 200,
    description: 'Return all vehicles',
    type: [Vehicle],
  })
  async findAll(@Query('status') status?: string): Promise<{ vehicles: Vehicle[] }> {
    if (status) {
      return this.vehiclesService.findByStatus(status).then((vehicles) => ({ vehicles }));
    }
    return this.vehiclesService.findAll().then((vehicles) => ({ vehicles }));
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get vehicle statistics' })
  @ApiResponse({
    status: 200,
    description: 'Return vehicle statistics',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 10 },
        available: { type: 'number', example: 7 },
        inUse: { type: 'number', example: 2 },
        maintenance: { type: 'number', example: 1 },
      },
    },
  })
  async getStatistics() {
    return this.vehiclesService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a vehicle by ID' })
  @ApiParam({ name: 'id', description: 'Vehicle UUID' })
  @ApiResponse({
    status: 200,
    description: 'Return the vehicle',
    type: Vehicle,
  })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async findOne(@Param('id') id: string): Promise<{ vehicle: Vehicle }> {
    const vehicle = await this.vehiclesService.findOne(id);
    return { vehicle };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a vehicle' })
  @ApiParam({ name: 'id', description: 'Vehicle UUID' })
  @ApiResponse({
    status: 200,
    description: 'The vehicle has been successfully updated',
    type: Vehicle,
  })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  @ApiResponse({
    status: 409,
    description: 'Vehicle with this license plate already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
  ): Promise<{ vehicle: Vehicle }> {
    const vehicle = await this.vehiclesService.update(id, updateVehicleDto);
    return { vehicle };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a vehicle' })
  @ApiParam({ name: 'id', description: 'Vehicle UUID' })
  @ApiResponse({
    status: 200,
    description: 'The vehicle has been successfully updated',
    type: Vehicle,
  })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  @ApiResponse({
    status: 409,
    description: 'Vehicle with this license plate already exists',
  })
  async patch(
    @Param('id') id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
  ): Promise<{ vehicle: Vehicle }> {
    const vehicle = await this.vehiclesService.update(id, updateVehicleDto);
    return { vehicle };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a vehicle' })
  @ApiParam({ name: 'id', description: 'Vehicle UUID' })
  @ApiResponse({
    status: 204,
    description: 'The vehicle has been successfully deleted',
  })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.vehiclesService.remove(id);
  }
}
