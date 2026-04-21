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
import { JobsService } from './jobs.service';
import { Job, JobStatus, JobPriority } from './entities/job.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

type AuthenticatedRequest = {
  user?: {
    userId?: string;
    organizationId?: string;
    roles?: string[];
  };
};

@ApiTags('jobs')
@Controller('jobs')
@ApiBearerAuth()
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new job' })
  @ApiResponse({ status: 201, description: 'Job created successfully', type: Job })
  @ApiResponse({ status: 400, description: 'Invalid input data or validation failed' })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() createJobDto: CreateJobDto,
  ): Promise<{ job: Job }> {
    const job = await this.jobsService.create(createJobDto, req.user);
    return { job };
  }

  @Post('import')
  @ApiOperation({ summary: 'Import multiple jobs' })
  @ApiResponse({ status: 201, description: 'Jobs imported successfully' })
  async importJobs(
    @Req() req: AuthenticatedRequest,
    @Body() body: { jobs: CreateJobDto[] },
  ): Promise<{ jobs: Job[]; count: number }> {
    const jobs = await this.jobsService.importJobs(body.jobs || [], req.user);
    return { jobs, count: jobs.length };
  }

  @Get()
  @ApiOperation({ summary: 'Get all jobs' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: JobStatus,
    description: 'Filter by job status',
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    enum: JobPriority,
    description: 'Filter by job priority',
  })
  @ApiResponse({ status: 200, description: 'List of jobs', type: [Job] })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ): Promise<{ jobs: Job[] }> {
    return this.jobsService.findAll(status, priority, undefined, undefined, undefined, req.user).then((jobs) => ({ jobs }));
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get job statistics' })
  @ApiResponse({
    status: 200,
    description: 'Job statistics by status and priority',
    schema: {
      type: 'object',
      properties: {
        byStatus: {
          type: 'object',
          additionalProperties: { type: 'number' },
        },
        byPriority: {
          type: 'object',
          additionalProperties: { type: 'number' },
        },
        total: { type: 'number' },
      },
    },
  })
  getStatistics(@Req() req: AuthenticatedRequest) {
    return this.jobsService.getStatistics(req.user);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get all pending jobs' })
  @ApiResponse({ status: 200, description: 'List of pending jobs', type: [Job] })
  findPending(@Req() req: AuthenticatedRequest): Promise<{ jobs: Job[] }> {
    return this.jobsService.findPending(req.user).then((jobs) => ({ jobs }));
  }

  @Get('queue')
  @ApiOperation({
    summary: 'Get BullMQ queue status for debugging',
    description: 'Returns current state of job queue including waiting, active, completed, and failed jobs',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue status with job counts and details',
    schema: {
      type: 'object',
      properties: {
        waiting: { type: 'array' },
        active: { type: 'array' },
        completed: { type: 'array' },
        failed: { type: 'array' },
        delayed: { type: 'array' },
        counts: {
          type: 'object',
          properties: {
            waiting: { type: 'number' },
            active: { type: 'number' },
            completed: { type: 'number' },
            failed: { type: 'number' },
            delayed: { type: 'number' },
          },
        },
      },
    },
  })
  async getQueueStatus() {
    return this.jobsService.getQueueStatus();
  }

  @Get('time-window')
  @ApiOperation({ summary: 'Get jobs within a time window' })
  @ApiQuery({
    name: 'start',
    required: true,
    description: 'Start of time window (ISO 8601)',
    example: '2024-01-15T00:00:00Z',
  })
  @ApiQuery({
    name: 'end',
    required: true,
    description: 'End of time window (ISO 8601)',
    example: '2024-01-15T23:59:59Z',
  })
  @ApiResponse({ status: 200, description: 'Jobs within time window', type: [Job] })
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  findByTimeWindow(
    @Req() req: AuthenticatedRequest,
    @Query('start') start: string,
    @Query('end') end: string,
  ): Promise<Job[]> {
    return this.jobsService.findByTimeWindow(new Date(start), new Date(end), req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a job by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Job found', type: Job })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ job: Job }> {
    const job = await this.jobsService.findOne(id, req.user);
    return { job };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a job' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Job updated successfully', type: Job })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data or validation failed' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateJobDto: UpdateJobDto,
  ): Promise<{ job: Job }> {
    return this.jobsService.update(id, updateJobDto, req.user).then((job) => ({ job }));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a job' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Job updated successfully', type: Job })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 400, description: 'Invalid input data or validation failed' })
  patch(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateJobDto: UpdateJobDto,
  ): Promise<{ job: Job }> {
    return this.jobsService.update(id, updateJobDto, req.user).then((job) => ({ job }));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a job (soft delete)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Job deleted successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.jobsService.remove(id, req.user);
  }
}
