import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { DriversService } from './drivers.service';
import { Driver } from './entities/driver.entity';
import { Shift } from './entities/shift.entity';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('drivers')
@Controller('api/drivers')
@ApiBearerAuth()
@Public()
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new driver' })
  @ApiResponse({ status: 201, description: 'Driver created successfully', type: Driver })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Email, license number, or employee ID already exists' })
  create(@Body() createDriverDto: CreateDriverDto): Promise<Driver> {
    return this.driversService.create(createDriverDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all drivers' })
  @ApiQuery({ name: 'status', required: false, enum: ['available', 'on_shift', 'on_break', 'off_duty'] })
  @ApiQuery({ name: 'employmentStatus', required: false, enum: ['active', 'on_leave', 'suspended', 'terminated'] })
  @ApiResponse({ status: 200, description: 'List of drivers', type: [Driver] })
  async findAll(
    @Query('status') status?: string,
    @Query('employmentStatus') employmentStatus?: string,
  ): Promise<Driver[]> {
    if (status) {
      return this.driversService.findByStatus(status);
    }
    if (employmentStatus) {
      return this.driversService.findByEmploymentStatus(employmentStatus);
    }
    return this.driversService.findAll();
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get driver statistics' })
  @ApiResponse({
    status: 200,
    description: 'Driver statistics by status and employment status',
    schema: {
      type: 'object',
      properties: {
        byStatus: {
          type: 'object',
          additionalProperties: { type: 'number' },
        },
        byEmploymentStatus: {
          type: 'object',
          additionalProperties: { type: 'number' },
        },
        total: { type: 'number' },
      },
    },
  })
  getStatistics() {
    return this.driversService.getStatistics();
  }

  @Get('licenses/expiring')
  @ApiOperation({ summary: 'Get drivers with expiring licenses' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Days until expiry (default: 30)' })
  @ApiResponse({ status: 200, description: 'Drivers with expiring licenses', type: [Driver] })
  findWithExpiringLicenses(@Query('days') days?: number): Promise<Driver[]> {
    return this.driversService.findWithExpiringLicenses(days);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a driver by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Driver found', type: Driver })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Driver> {
    return this.driversService.findOne(id);
  }

  @Get(':id/shifts')
  @ApiOperation({ summary: 'Get all shifts for a driver' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit number of shifts returned' })
  @ApiResponse({ status: 200, description: 'List of driver shifts', type: [Shift] })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  async getDriverShifts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
  ): Promise<Shift[]> {
    if (limit) {
      return this.driversService.getRecentShifts(id, limit);
    }
    return this.driversService.getDriverShifts(id);
  }

  @Get(':id/shifts/current')
  @ApiOperation({ summary: 'Get current active shift for a driver' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Current shift', type: Shift })
  @ApiResponse({ status: 404, description: 'No active shift found' })
  getCurrentShift(@Param('id', ParseUUIDPipe) id: string): Promise<Shift | null> {
    return this.driversService.getCurrentShift(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a driver' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Driver updated successfully', type: Driver })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  @ApiResponse({ status: 409, description: 'Email, license number, or employee ID already exists' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDriverDto: UpdateDriverDto,
  ): Promise<Driver> {
    return this.driversService.update(id, updateDriverDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a driver (soft delete)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Driver deleted successfully' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.driversService.remove(id);
  }
}
