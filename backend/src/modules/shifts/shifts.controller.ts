import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
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
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto } from '../drivers/dto/create-shift.dto';
import { Shift } from '../drivers/entities/shift.entity';

@ApiTags('shifts')
@ApiBearerAuth('JWT-auth')
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new shift' })
  @ApiResponse({
    status: 201,
    description: 'The shift has been successfully created with status "scheduled"',
    type: Shift,
  })
  @ApiResponse({
    status: 404,
    description: 'Driver or vehicle not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Driver already has a shift scheduled during this time',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or scheduling conflict',
  })
  async create(@Body() createShiftDto: CreateShiftDto): Promise<Shift> {
    return this.shiftsService.create(createShiftDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all shifts' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by shift status',
    example: 'scheduled',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Filter by shift date (YYYY-MM-DD)',
    example: '2024-12-20',
  })
  @ApiResponse({
    status: 200,
    description: 'Return all shifts',
    type: [Shift],
  })
  async findAll(
    @Query('status') status?: string,
    @Query('date') date?: string,
  ): Promise<Shift[]> {
    if (status) {
      return this.shiftsService.findByStatus(status);
    }
    if (date) {
      return this.shiftsService.findByDate(date);
    }
    return this.shiftsService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active shifts (scheduled or in progress)' })
  @ApiResponse({
    status: 200,
    description: 'Return active shifts',
    type: [Shift],
  })
  async getActiveShifts(): Promise<Shift[]> {
    return this.shiftsService.getActiveShifts();
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get shift statistics' })
  @ApiResponse({
    status: 200,
    description: 'Return shift statistics',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 100 },
        scheduled: { type: 'number', example: 25 },
        inProgress: { type: 'number', example: 15 },
        completed: { type: 'number', example: 55 },
        cancelled: { type: 'number', example: 3 },
        noShow: { type: 'number', example: 2 },
      },
    },
  })
  async getStatistics() {
    return this.shiftsService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a shift by ID' })
  @ApiParam({ name: 'id', description: 'Shift UUID' })
  @ApiResponse({
    status: 200,
    description: 'Return the shift',
    type: Shift,
  })
  @ApiResponse({ status: 404, description: 'Shift not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Shift> {
    return this.shiftsService.findOne(id);
  }

  @Patch(':id/start')
  @ApiOperation({ summary: 'Start a shift (set actual_start, status = in_progress)' })
  @ApiParam({ name: 'id', description: 'Shift UUID' })
  @ApiResponse({
    status: 200,
    description: 'The shift has been started',
    type: Shift,
  })
  @ApiResponse({
    status: 404,
    description: 'Shift not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Shift cannot be started in current status',
  })
  async startShift(@Param('id', ParseUUIDPipe) id: string): Promise<Shift> {
    return this.shiftsService.startShift(id);
  }

  @Patch(':id/end')
  @ApiOperation({ summary: 'End a shift (set actual_end, status = completed)' })
  @ApiParam({ name: 'id', description: 'Shift UUID' })
  @ApiResponse({
    status: 200,
    description: 'The shift has been ended',
    type: Shift,
  })
  @ApiResponse({
    status: 404,
    description: 'Shift not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Shift cannot be ended in current status',
  })
  async endShift(@Param('id', ParseUUIDPipe) id: string): Promise<Shift> {
    return this.shiftsService.endShift(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a shift' })
  @ApiParam({ name: 'id', description: 'Shift UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', example: 'Driver unavailable' },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'The shift has been cancelled',
    type: Shift,
  })
  @ApiResponse({
    status: 404,
    description: 'Shift not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel a completed shift',
  })
  async cancelShift(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ): Promise<Shift> {
    return this.shiftsService.cancelShift(id, reason);
  }
}
