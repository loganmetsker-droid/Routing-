import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Job, JobStatus, JobPriority } from './entities/job.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  // Capacity constraints (configurable)
  private readonly MAX_WEIGHT_KG = 10000; // 10 tons
  private readonly MAX_VOLUME_M3 = 50; // 50 cubic meters
  private readonly MAX_QUANTITY = 1000; // 1000 items

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectQueue('jobs')
    private readonly jobQueue: Queue,
  ) {}

  async create(createJobDto: CreateJobDto): Promise<Job> {
    // Validate time window: start must be before end
    const timeWindowStart = new Date(createJobDto.timeWindowStart);
    const timeWindowEnd = new Date(createJobDto.timeWindowEnd);

    if (timeWindowEnd <= timeWindowStart) {
      throw new BadRequestException(
        'Time window end must be after time window start',
      );
    }

    // Validate time window duration (e.g., minimum 30 minutes)
    const durationMinutes =
      (timeWindowEnd.getTime() - timeWindowStart.getTime()) / (1000 * 60);
    if (durationMinutes < 30) {
      throw new BadRequestException(
        'Time window must be at least 30 minutes',
      );
    }

    // Validate capacity constraints
    if (createJobDto.weight && createJobDto.weight > this.MAX_WEIGHT_KG) {
      throw new BadRequestException(
        `Weight exceeds maximum capacity of ${this.MAX_WEIGHT_KG} kg`,
      );
    }

    if (createJobDto.volume && createJobDto.volume > this.MAX_VOLUME_M3) {
      throw new BadRequestException(
        `Volume exceeds maximum capacity of ${this.MAX_VOLUME_M3} m³`,
      );
    }

    if (createJobDto.quantity && createJobDto.quantity > this.MAX_QUANTITY) {
      throw new BadRequestException(
        `Quantity exceeds maximum capacity of ${this.MAX_QUANTITY} items`,
      );
    }

    // Create job with automatic "pending" status
    const job = this.jobRepository.create({
      ...createJobDto,
      status: JobStatus.PENDING,
      priority: createJobDto.priority || JobPriority.NORMAL,
    });

    const savedJob = await this.jobRepository.save(job);

    // Add to BullMQ queue for processing
    await this.addToQueue(savedJob);

    this.logger.log(`Created job ${savedJob.id} and added to queue`);

    return savedJob;
  }

  async findAll(status?: string, priority?: string): Promise<Job[]> {
    const queryBuilder = this.jobRepository.createQueryBuilder('job');

    if (status) {
      queryBuilder.andWhere('job.status = :status', { status });
    }

    if (priority) {
      queryBuilder.andWhere('job.priority = :priority', { priority });
    }

    queryBuilder.orderBy('job.priority', 'DESC').addOrderBy('job.createdAt', 'ASC');

    return queryBuilder.getMany();
  }

  async findOne(id: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id } });

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return job;
  }

  async findByStatus(status: JobStatus): Promise<Job[]> {
    return this.jobRepository.find({
      where: { status },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  async findByPriority(priority: JobPriority): Promise<Job[]> {
    return this.jobRepository.find({
      where: { priority },
      order: { createdAt: 'ASC' },
    });
  }

  async findPending(): Promise<Job[]> {
    return this.findByStatus(JobStatus.PENDING);
  }

  async findByTimeWindow(start: Date, end: Date): Promise<Job[]> {
    return this.jobRepository
      .createQueryBuilder('job')
      .where('job.time_window_start >= :start', { start })
      .andWhere('job.time_window_end <= :end', { end })
      .orderBy('job.time_window_start', 'ASC')
      .getMany();
  }

  async update(id: string, updateJobDto: UpdateJobDto): Promise<Job> {
    const job = await this.findOne(id);

    // Validate time window if being updated
    if (updateJobDto.timeWindowStart || updateJobDto.timeWindowEnd) {
      const timeWindowStart = updateJobDto.timeWindowStart
        ? new Date(updateJobDto.timeWindowStart)
        : job.timeWindowStart;
      const timeWindowEnd = updateJobDto.timeWindowEnd
        ? new Date(updateJobDto.timeWindowEnd)
        : job.timeWindowEnd;

      if (timeWindowEnd <= timeWindowStart) {
        throw new BadRequestException(
          'Time window end must be after time window start',
        );
      }

      const durationMinutes =
        (timeWindowEnd.getTime() - timeWindowStart.getTime()) / (1000 * 60);
      if (durationMinutes < 30) {
        throw new BadRequestException(
          'Time window must be at least 30 minutes',
        );
      }
    }

    // Validate capacity constraints if being updated
    const newWeight = updateJobDto.weight ?? job.weight;
    if (newWeight && newWeight > this.MAX_WEIGHT_KG) {
      throw new BadRequestException(
        `Weight exceeds maximum capacity of ${this.MAX_WEIGHT_KG} kg`,
      );
    }

    const newVolume = updateJobDto.volume ?? job.volume;
    if (newVolume && newVolume > this.MAX_VOLUME_M3) {
      throw new BadRequestException(
        `Volume exceeds maximum capacity of ${this.MAX_VOLUME_M3} m³`,
      );
    }

    const newQuantity = updateJobDto.quantity ?? job.quantity;
    if (newQuantity && newQuantity > this.MAX_QUANTITY) {
      throw new BadRequestException(
        `Quantity exceeds maximum capacity of ${this.MAX_QUANTITY} items`,
      );
    }

    // If status changes from pending to something else, remove from queue
    if (
      updateJobDto.status &&
      updateJobDto.status !== JobStatus.PENDING &&
      job.status === JobStatus.PENDING
    ) {
      await this.removeFromQueue(job.id);
    }

    // If status changes to pending, add to queue
    if (
      updateJobDto.status === JobStatus.PENDING &&
      job.status !== JobStatus.PENDING
    ) {
      await this.addToQueue(job);
    }

    Object.assign(job, updateJobDto);

    return this.jobRepository.save(job);
  }

  async remove(id: string): Promise<void> {
    const job = await this.findOne(id);

    // Remove from queue if pending
    if (job.status === JobStatus.PENDING) {
      await this.removeFromQueue(id);
    }

    await this.jobRepository.softRemove(job);
  }

  async getStatistics() {
    const [byStatus, byPriority, total] = await Promise.all([
      this.jobRepository
        .createQueryBuilder('job')
        .select('job.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('job.status')
        .getRawMany(),
      this.jobRepository
        .createQueryBuilder('job')
        .select('job.priority', 'priority')
        .addSelect('COUNT(*)', 'count')
        .groupBy('job.priority')
        .getRawMany(),
      this.jobRepository.count(),
    ]);

    return {
      byStatus: byStatus.reduce(
        (acc, { status, count }) => ({ ...acc, [status]: parseInt(count) }),
        {},
      ),
      byPriority: byPriority.reduce(
        (acc, { priority, count }) => ({ ...acc, [priority]: parseInt(count) }),
        {},
      ),
      total,
    };
  }

  // BullMQ Queue Management
  async addToQueue(job: Job): Promise<void> {
    await this.jobQueue.add(
      'process-job',
      {
        jobId: job.id,
        priority: job.priority,
        timeWindowStart: job.timeWindowStart,
        timeWindowEnd: job.timeWindowEnd,
      },
      {
        jobId: job.id,
        priority: this.getPriorityValue(job.priority),
        delay: this.calculateDelay(job.timeWindowStart),
      },
    );

    this.logger.debug(`Added job ${job.id} to queue with priority ${job.priority}`);
  }

  async removeFromQueue(jobId: string): Promise<void> {
    const bullJob = await this.jobQueue.getJob(jobId);
    if (bullJob) {
      await bullJob.remove();
      this.logger.debug(`Removed job ${jobId} from queue`);
    }
  }

  async getQueueStatus() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.jobQueue.getWaiting(),
      this.jobQueue.getActive(),
      this.jobQueue.getCompleted(),
      this.jobQueue.getFailed(),
      this.jobQueue.getDelayed(),
    ]);

    return {
      waiting: waiting.map(this.formatBullJob),
      active: active.map(this.formatBullJob),
      completed: completed.slice(0, 10).map(this.formatBullJob), // Last 10
      failed: failed.slice(0, 10).map(this.formatBullJob), // Last 10
      delayed: delayed.map(this.formatBullJob),
      counts: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      },
    };
  }

  private formatBullJob(bullJob: any) {
    return {
      id: bullJob.id,
      data: bullJob.data,
      progress: bullJob.progress(),
      attemptsMade: bullJob.attemptsMade,
      processedOn: bullJob.processedOn,
      finishedOn: bullJob.finishedOn,
      timestamp: bullJob.timestamp,
    };
  }

  private getPriorityValue(priority: JobPriority): number {
    const priorityMap = {
      [JobPriority.URGENT]: 1,
      [JobPriority.HIGH]: 2,
      [JobPriority.NORMAL]: 3,
      [JobPriority.LOW]: 4,
    };
    return priorityMap[priority] || 3;
  }

  private calculateDelay(timeWindowStart: Date): number {
    const now = new Date();
    const start = new Date(timeWindowStart);
    const delayMs = start.getTime() - now.getTime();

    // If time window already started, no delay
    if (delayMs <= 0) {
      return 0;
    }

    // Start processing 30 minutes before time window
    return Math.max(0, delayMs - 30 * 60 * 1000);
  }
}
