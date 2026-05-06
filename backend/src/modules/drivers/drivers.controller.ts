import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Req,
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

type AuthenticatedRequest = {
  user?: {
    organizationId?: string;
  };
};

@ApiTags('drivers')
@Controller('drivers')
@ApiBearerAuth()
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new driver' })
  @ApiResponse({ status: 201, description: 'Driver created successfully', type: Driver })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Email, license number, or employee ID already exists' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() createDriverDto: CreateDriverDto,
  ): Promise<{ driver: Driver }> {
    const driver = await this.driversService.create(createDriverDto, req.user);
    return { driver };
  }

  @Get()
  @ApiOperation({ summary: 'Get all drivers' })
  @ApiQuery({ name: 'status', required: false, enum: ['available', 'on_shift', 'on_break', 'off_duty'] })
  @ApiQuery({ name: 'employmentStatus', required: false, enum: ['active', 'on_leave', 'suspended', 'terminated'] })
  @ApiResponse({ status: 200, description: 'List of drivers', type: [Driver] })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('employmentStatus') employmentStatus?: string,
  ): Promise<{ drivers: Driver[] }> {
    if (status) {
      return this.driversService
        .findByStatus(status, req.user)
        .then((drivers) => ({ drivers }));
    }
    if (employmentStatus) {
      return this.driversService
        .findByEmploymentStatus(employmentStatus, req.user)
        .then((drivers) => ({ drivers }));
    }
    return this.driversService.findAll(req.user).then((drivers) => ({ drivers }));
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
  getStatistics(@Req() req: AuthenticatedRequest) {
    return this.driversService.getStatistics(req.user);
  }

  @Get('licenses/expiring')
  @ApiOperation({ summary: 'Get drivers with expiring licenses' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Days until expiry (default: 30)' })
  @ApiResponse({ status: 200, description: 'Drivers with expiring licenses', type: [Driver] })
  findWithExpiringLicenses(
    @Req() req: AuthenticatedRequest,
    @Query('days') days?: number,
  ): Promise<Driver[]> {
    return this.driversService.findWithExpiringLicenses(days, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a driver by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Driver found', type: Driver })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ driver: Driver }> {
    const driver = await this.driversService.findOne(id, req.user);
    return { driver };
  }

  @Get(':id/shifts')
  @ApiOperation({ summary: 'Get all shifts for a driver' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit number of shifts returned' })
  @ApiResponse({ status: 200, description: 'List of driver shifts', type: [Shift] })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  async getDriverShifts(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
  ): Promise<Shift[]> {
    if (limit) {
      return this.driversService.getRecentShifts(id, limit, req.user);
    }
    return this.driversService.getDriverShifts(id, req.user);
  }

  @Get(':id/shifts/current')
  @ApiOperation({ summary: 'Get current active shift for a driver' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Current shift', type: Shift })
  @ApiResponse({ status: 404, description: 'No active shift found' })
  getCurrentShift(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Shift | null> {
    return this.driversService.getCurrentShift(id, req.user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a driver' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Driver updated successfully', type: Driver })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  @ApiResponse({ status: 409, description: 'Email, license number, or employee ID already exists' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDriverDto: UpdateDriverDto,
  ): Promise<{ driver: Driver }> {
    return this.driversService
      .update(id, updateDriverDto, req.user)
      .then((driver) => ({ driver }));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a driver' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Driver updated successfully', type: Driver })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  @ApiResponse({ status: 409, description: 'Email, license number, or employee ID already exists' })
  patch(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDriverDto: UpdateDriverDto,
  ): Promise<{ driver: Driver }> {
    return this.driversService
      .update(id, updateDriverDto, req.user)
      .then((driver) => ({ driver }));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a driver (soft delete)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Driver deleted successfully' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.driversService.remove(id, req.user);
  }
}
