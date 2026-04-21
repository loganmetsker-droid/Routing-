import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Job, JobStatus, JobPriority, BillingStatus } from './entities/job.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { UpdateBillingDto } from './dto/update-billing.dto';
import { UpdateLifecycleDto } from './dto/update-lifecycle.dto';
import { Between, IsNull } from 'typeorm';
import {
  JOB_ALLOWED_TRANSITIONS,
  normalizeLifecycleJobStatus,
} from './jobs-workflow';

type Actor = {
  userId?: string;
  organizationId?: string;
};

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
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @Optional()
    @InjectQueue('jobs')
    private readonly jobQueue?: Queue,
  ) {}

  private normalizeAddressString(
    structured?: {
      line1?: string;
      line2?: string | null;
      city?: string;
      state?: string;
      zip?: string;
    } | null,
  ): string | undefined {
    if (!structured || !structured.line1) {
      return undefined;
    }
    const parts = [
      structured.line1,
      structured.line2 || undefined,
      [structured.city, structured.state, structured.zip]
        .filter(Boolean)
        .join(' ')
        .trim() || undefined,
    ].filter(Boolean);
    return parts.join(', ');
  }

  private normalizeStructuredAddress<T extends {
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    zip?: string;
  } | null | undefined>(structured: T): T {
    if (!structured) return structured;
    const normalized = {
      ...structured,
      line1: structured.line1?.trim() || '',
      line2: structured.line2?.trim() || null,
      city: structured.city?.trim() || '',
      state: structured.state?.trim().toUpperCase() || '',
      zip: structured.zip?.trim() || '',
    };
    return normalized as T;
  }

  private normalizeLifecycleStatus(status: JobStatus): JobStatus {
    return normalizeLifecycleJobStatus(status);
  }

  private ensureValidStatusTransition(current: JobStatus, next: JobStatus) {
    const normalizedCurrent = this.normalizeLifecycleStatus(current);
    const normalizedNext = this.normalizeLifecycleStatus(next);

    if (normalizedCurrent === normalizedNext) {
      return normalizedNext;
    }

    const allowed = JOB_ALLOWED_TRANSITIONS[normalizedCurrent] || [];
    if (!allowed.includes(normalizedNext)) {
      throw new BadRequestException(
        `Invalid job transition: ${normalizedCurrent} -> ${normalizedNext}`,
      );
    }

    return normalizedNext;
  }

  private organizationWhere(actor?: Actor) {
    return actor?.organizationId ? ({ organizationId: actor.organizationId } as const) : {};
  }

  private requireCustomerScope(customer: Customer, actor?: Actor) {
    if (
      actor?.organizationId &&
      customer.organizationId &&
      customer.organizationId !== actor.organizationId
    ) {
      throw new BadRequestException(`Customer with ID ${customer.id} not found`);
    }
  }

  async create(createJobDto: CreateJobDto, actor?: Actor): Promise<Job> {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    // Support both new and legacy frontend payload shapes.
    const rawStart =
      createJobDto.timeWindowStart || createJobDto.timeWindow?.start || now.toISOString();
    const rawEnd =
      createJobDto.timeWindowEnd || createJobDto.timeWindow?.end || oneHourLater.toISOString();

    const timeWindowStart = new Date(rawStart);
    const timeWindowEnd = new Date(rawEnd);

    if (Number.isNaN(timeWindowStart.getTime()) || Number.isNaN(timeWindowEnd.getTime())) {
      throw new BadRequestException('Invalid time window format');
    }

    // Validate time window: start must be before end
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

    const linkedCustomer = createJobDto.customerId
      ? await this.customerRepository.findOne({
          where: { id: createJobDto.customerId, ...this.organizationWhere(actor) },
        })
      : null;

    if (createJobDto.customerId && !linkedCustomer) {
      throw new BadRequestException(
        `Customer with ID ${createJobDto.customerId} not found`,
      );
    }

    if (linkedCustomer) {
      this.requireCustomerScope(linkedCustomer, actor);
    }

    const resolvedCustomerName = createJobDto.customerName || linkedCustomer?.name;
    const resolvedCustomerPhone = createJobDto.customerPhone || linkedCustomer?.phone;
    const resolvedCustomerEmail = createJobDto.customerEmail || linkedCustomer?.email;
    const resolvedDeliveryAddress =
      createJobDto.deliveryAddress ||
      this.normalizeAddressString(createJobDto.deliveryAddressStructured as any) ||
      linkedCustomer?.defaultAddress;

    if (!resolvedCustomerName || !resolvedDeliveryAddress) {
      throw new BadRequestException(
        'customerName and deliveryAddress are required',
      );
    }

    // Create job with automatic "pending" status
    const job = this.jobRepository.create({
      ...createJobDto,
      ...this.organizationWhere(actor),
      pickupAddressStructured: this.normalizeStructuredAddress(
        createJobDto.pickupAddressStructured as any,
      ),
      deliveryAddressStructured: this.normalizeStructuredAddress(
        createJobDto.deliveryAddressStructured as any,
      ),
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      customerEmail: resolvedCustomerEmail,
      deliveryAddress: resolvedDeliveryAddress,
      pickupAddress:
        createJobDto.pickupAddress ||
        this.normalizeAddressString(createJobDto.pickupAddressStructured as any) ||
        '',
      timeWindowStart,
      timeWindowEnd,
      status: this.normalizeLifecycleStatus(createJobDto.status || JobStatus.PENDING),
      priority: createJobDto.priority || JobPriority.NORMAL,
    });

    const savedJob = await this.jobRepository.save(job);

    // Add to BullMQ queue for processing
    await this.addToQueue(savedJob);

    this.logger.log(`Created job ${savedJob.id} and added to queue`);

    return savedJob;
  }

  async importJobs(items: CreateJobDto[], actor?: Actor): Promise<Job[]> {
    const created: Job[] = [];
    for (const item of items) {
      created.push(await this.create(item, actor));
    }
    return created;
  }

  async findAll(
    status?: string,
    priority?: string,
    billingStatus?: string,
    startDate?: Date,
    endDate?: Date,
    actor?: Actor,
  ): Promise<Job[]> {
    const queryBuilder = this.jobRepository.createQueryBuilder('job');

    // Exclude archived jobs by default
    queryBuilder.andWhere('job.archived_at IS NULL');

    if (actor?.organizationId) {
      queryBuilder.andWhere('job.organization_id = :organizationId', {
        organizationId: actor.organizationId,
      });
    }

    if (status) {
      queryBuilder.andWhere('job.status = :status', { status });
    }

    if (priority) {
      queryBuilder.andWhere('job.priority = :priority', { priority });
    }

    if (billingStatus) {
      queryBuilder.andWhere('job.billing_status = :billingStatus', { billingStatus });
    }

    if (startDate) {
      queryBuilder.andWhere('job.start_date >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('job.end_date <= :endDate', { endDate });
    }

    queryBuilder.orderBy('job.priority', 'DESC').addOrderBy('job.createdAt', 'ASC');

    return queryBuilder.getMany();
  }

  async findOne(id: string, actor?: Actor): Promise<Job> {
    const job = await this.jobRepository.findOne({
      where: { id, ...this.organizationWhere(actor) },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return job;
  }

  async findByStatus(status: JobStatus, actor?: Actor): Promise<Job[]> {
    return this.jobRepository.find({
      where: { status, ...this.organizationWhere(actor) },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  async findByPriority(priority: JobPriority, actor?: Actor): Promise<Job[]> {
    return this.jobRepository.find({
      where: { priority, ...this.organizationWhere(actor) },
      order: { createdAt: 'ASC' },
    });
  }

  async findPending(actor?: Actor): Promise<Job[]> {
    return this.findByStatus(JobStatus.PENDING, actor);
  }

  async findByTimeWindow(start: Date, end: Date, actor?: Actor): Promise<Job[]> {
    const queryBuilder = this.jobRepository
      .createQueryBuilder('job')
      .where('job.time_window_start >= :start', { start })
      .andWhere('job.time_window_end <= :end', { end });

    if (actor?.organizationId) {
      queryBuilder.andWhere('job.organization_id = :organizationId', {
        organizationId: actor.organizationId,
      });
    }

    return queryBuilder.orderBy('job.time_window_start', 'ASC').getMany();
  }

  async update(id: string, updateJobDto: UpdateJobDto, actor?: Actor): Promise<Job> {
    const job = await this.findOne(id, actor);

    // Support legacy archive payloads from older UI screens.
    const { archived, driverId, assignedVehicleId, stopSequence, ...safeUpdateDto } =
      updateJobDto as UpdateJobDto & {
        archived?: boolean;
        driverId?: string;
        assignedVehicleId?: string;
        stopSequence?: number;
      };

    // Mark fields as intentionally unused legacy fields (ignored but accepted).
    void driverId;
    void assignedVehicleId;
    void stopSequence;

    if (archived === true) {
      safeUpdateDto.status = JobStatus.ARCHIVED;
      safeUpdateDto.archivedAt = safeUpdateDto.archivedAt || new Date().toISOString();
    }

    if (archived === false) {
      safeUpdateDto.archivedAt = null as any;
      if (!safeUpdateDto.status) {
        safeUpdateDto.status = JobStatus.PENDING;
      }
    }

    if (safeUpdateDto.deliveryAddressStructured) {
      safeUpdateDto.deliveryAddressStructured = this.normalizeStructuredAddress(
        safeUpdateDto.deliveryAddressStructured as any,
      );
    }

    if (safeUpdateDto.pickupAddressStructured) {
      safeUpdateDto.pickupAddressStructured = this.normalizeStructuredAddress(
        safeUpdateDto.pickupAddressStructured as any,
      );
    }

    if (safeUpdateDto.deliveryAddressStructured && !safeUpdateDto.deliveryAddress) {
      const normalized = this.normalizeAddressString(
        safeUpdateDto.deliveryAddressStructured as any,
      );
      if (normalized) {
        safeUpdateDto.deliveryAddress = normalized;
      }
    }

    if (safeUpdateDto.pickupAddressStructured && !safeUpdateDto.pickupAddress) {
      const normalized = this.normalizeAddressString(
        safeUpdateDto.pickupAddressStructured as any,
      );
      if (normalized) {
        safeUpdateDto.pickupAddress = normalized;
      }
    }

    if (safeUpdateDto.status) {
      const normalizedNextStatus = this.ensureValidStatusTransition(
        job.status,
        safeUpdateDto.status,
      );
      safeUpdateDto.status = normalizedNextStatus;
    }

    if (safeUpdateDto.status === JobStatus.ARCHIVED && !safeUpdateDto.archivedAt) {
      safeUpdateDto.archivedAt = new Date().toISOString();
    }

    if (
      safeUpdateDto.status === JobStatus.COMPLETED &&
      !safeUpdateDto.completedAt
    ) {
      safeUpdateDto.completedAt = new Date().toISOString();
    }

    // Validate time window if being updated
    if (safeUpdateDto.timeWindowStart || safeUpdateDto.timeWindowEnd) {
      const timeWindowStart = safeUpdateDto.timeWindowStart
        ? new Date(safeUpdateDto.timeWindowStart)
        : job.timeWindowStart;
      const timeWindowEnd = safeUpdateDto.timeWindowEnd
        ? new Date(safeUpdateDto.timeWindowEnd)
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
    const newWeight = safeUpdateDto.weight ?? job.weight;
    if (newWeight && newWeight > this.MAX_WEIGHT_KG) {
      throw new BadRequestException(
        `Weight exceeds maximum capacity of ${this.MAX_WEIGHT_KG} kg`,
      );
    }

    const newVolume = safeUpdateDto.volume ?? job.volume;
    if (newVolume && newVolume > this.MAX_VOLUME_M3) {
      throw new BadRequestException(
        `Volume exceeds maximum capacity of ${this.MAX_VOLUME_M3} m³`,
      );
    }

    const newQuantity = safeUpdateDto.quantity ?? job.quantity;
    if (newQuantity && newQuantity > this.MAX_QUANTITY) {
      throw new BadRequestException(
        `Quantity exceeds maximum capacity of ${this.MAX_QUANTITY} items`,
      );
    }

    // If status changes from pending to something else, remove from queue
    if (
      safeUpdateDto.status &&
      safeUpdateDto.status !== JobStatus.PENDING &&
      this.normalizeLifecycleStatus(job.status) === JobStatus.PENDING
    ) {
      await this.removeFromQueue(job.id);
    }

    // If status changes to pending, add to queue
    if (
      safeUpdateDto.status === JobStatus.PENDING &&
      this.normalizeLifecycleStatus(job.status) !== JobStatus.PENDING
    ) {
      await this.addToQueue(job);
    }

    Object.assign(job, safeUpdateDto);

    return this.jobRepository.save(job);
  }

  async remove(id: string, actor?: Actor): Promise<void> {
    const job = await this.findOne(id, actor);

    // Remove from queue if pending
    if (job.status === JobStatus.PENDING) {
      await this.removeFromQueue(id);
    }

    await this.jobRepository.softRemove(job);
  }

  async getStatistics(actor?: Actor) {
    const baseQuery = () => {
      const query = this.jobRepository.createQueryBuilder('job');
      if (actor?.organizationId) {
        query.andWhere('job.organization_id = :organizationId', {
          organizationId: actor.organizationId,
        });
      }
      return query;
    };

    const [byStatus, byPriority, total] = await Promise.all([
      baseQuery()
        .select('job.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('job.status')
        .getRawMany(),
      baseQuery()
        .select('job.priority', 'priority')
        .addSelect('COUNT(*)', 'count')
        .groupBy('job.priority')
        .getRawMany(),
      this.jobRepository.count({ where: this.organizationWhere(actor) as any }),
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
    if (!this.jobQueue) {
      this.logger.debug(`Skipping queue add for job ${job.id} (Redis queue disabled)`);
      return;
    }

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
    if (!this.jobQueue) {
      return;
    }

    const bullJob = await this.jobQueue.getJob(jobId);
    if (bullJob) {
      await bullJob.remove();
      this.logger.debug(`Removed job ${jobId} from queue`);
    }
  }

  async getQueueStatus() {
    if (!this.jobQueue) {
      return {
        waiting: [],
        active: [],
        completed: [],
        failed: [],
        delayed: [],
        counts: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        },
        queueEnabled: false,
      };
    }

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
      queueEnabled: true,
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

  // New workflow methods

  async updateBilling(id: string, updateBillingDto: UpdateBillingDto, actor?: Actor): Promise<Job> {
    const job = await this.findOne(id, actor);

    Object.assign(job, {
      billingStatus: updateBillingDto.billingStatus,
      billingAmount: updateBillingDto.billingAmount,
      billingNotes: updateBillingDto.billingNotes,
      invoiceRef: updateBillingDto.invoiceRef,
    });

    return this.jobRepository.save(job);
  }

  async updateLifecycle(id: string, updateLifecycleDto: UpdateLifecycleDto, actor?: Actor): Promise<Job> {
    const job = await this.findOne(id, actor);
    const nextStatus = this.ensureValidStatusTransition(job.status, updateLifecycleDto.status);

    Object.assign(job, {
      status: nextStatus,
      startDate: updateLifecycleDto.startDate ? new Date(updateLifecycleDto.startDate) : job.startDate,
      endDate: updateLifecycleDto.endDate ? new Date(updateLifecycleDto.endDate) : job.endDate,
    });

    // If archiving, set archivedAt timestamp
    if (nextStatus === JobStatus.ARCHIVED) {
      job.archivedAt = new Date();
    }
    if (nextStatus === JobStatus.COMPLETED && !job.completedAt) {
      job.completedAt = new Date();
    }

    return this.jobRepository.save(job);
  }

  async cloneJob(id: string, actor?: Actor): Promise<Job> {
    const sourceJob = await this.findOne(id, actor);

    // Create new job with same properties but reset status and dates
    const clonedJob = this.jobRepository.create({
      customerName: sourceJob.customerName,
      customerPhone: sourceJob.customerPhone,
      customerEmail: sourceJob.customerEmail,
      pickupAddress: sourceJob.pickupAddress,
      deliveryAddress: sourceJob.deliveryAddress,
      pickupAddressStructured: sourceJob.pickupAddressStructured,
      deliveryAddressStructured: sourceJob.deliveryAddressStructured,
      pickupLocation: sourceJob.pickupLocation,
      deliveryLocation: sourceJob.deliveryLocation,
      priority: sourceJob.priority,
      weight: sourceJob.weight,
      volume: sourceJob.volume,
      quantity: sourceJob.quantity,
      notes: sourceJob.notes,
      specialInstructions: sourceJob.specialInstructions,
      customerId: sourceJob.customerId,
      organizationId: sourceJob.organizationId,
      timeWindowStart: sourceJob.timeWindowStart,
      timeWindowEnd: sourceJob.timeWindowEnd,
      // Reset workflow fields
      status: JobStatus.UNSCHEDULED,
      startDate: undefined,
      endDate: undefined,
      billingStatus: BillingStatus.UNPAID,
      billingAmount: sourceJob.billingAmount,
      billingNotes: undefined,
      invoiceRef: undefined,
    });

    return this.jobRepository.save(clonedJob);
  }

  async findHistory(start: Date, end: Date, actor?: Actor): Promise<Job[]> {
    return this.jobRepository.find({
      where: [
        {
          startDate: Between(start, end),
          ...this.organizationWhere(actor),
        },
        {
          endDate: Between(start, end),
          ...this.organizationWhere(actor),
        },
      ],
      order: { startDate: 'ASC' },
    });
  }

  async findCustomerHistory(customerId: string, actor?: Actor): Promise<Job[]> {
    return this.jobRepository.find({
      where: { customerId, ...this.organizationWhere(actor) },
      order: { createdAt: 'DESC' },
    });
  }

  async findArchived(actor?: Actor): Promise<Job[]> {
    return this.jobRepository.find({
      where: { status: JobStatus.ARCHIVED, ...this.organizationWhere(actor) },
      order: { archivedAt: 'DESC' },
    });
  }

  async getCalendarData(
    start: Date,
    end: Date,
    resourceView?: string,
  ): Promise<any[]> {
    const queryBuilder = this.jobRepository
      .createQueryBuilder('job')
      .where('job.start_date IS NOT NULL')
      .andWhere('job.archived_at IS NULL')
      .andWhere(
        '(job.start_date BETWEEN :start AND :end OR job.end_date BETWEEN :start AND :end)',
        { start, end },
      );

    const jobs = await queryBuilder.getMany();

    // Format for FullCalendar
    return jobs.map((job) => ({
      id: job.id,
      title: job.customerName || 'Untitled Job',
      start: job.startDate,
      end: job.endDate,
      backgroundColor: this.getStatusColor(job.status),
      borderColor: this.getBillingBorderColor(job.billingStatus),
      extendedProps: {
        status: job.status,
        billingStatus: job.billingStatus,
        priority: job.priority,
        pickupAddress: job.pickupAddress,
        deliveryAddress: job.deliveryAddress,
        notes: job.notes,
        assignedRouteId: job.assignedRouteId,
      },
    }));
  }

  private getStatusColor(status: JobStatus): string {
    const colorMap = {
      [JobStatus.UNSCHEDULED]: '#9e9e9e',
      [JobStatus.SCHEDULED]: '#2196f3',
      [JobStatus.IN_PROGRESS]: '#ff9800',
      [JobStatus.COMPLETED]: '#4caf50',
      [JobStatus.ARCHIVED]: '#607d8b',
      [JobStatus.CANCELLED]: '#f44336',
      [JobStatus.FAILED]: '#d32f2f',
      [JobStatus.PENDING]: '#9e9e9e',
      [JobStatus.ASSIGNED]: '#2196f3',
    };
    return colorMap[status] || '#9e9e9e';
  }

  private getBillingBorderColor(billingStatus: string): string {
    return billingStatus === 'paid' ? '#4caf50' : '#f44336';
  }
}
