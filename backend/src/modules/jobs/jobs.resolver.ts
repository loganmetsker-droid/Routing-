import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { JobsService } from './jobs.service';
import { Job } from './entities/job.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { UpdateBillingDto } from './dto/update-billing.dto';
import { UpdateLifecycleDto } from './dto/update-lifecycle.dto';

@Resolver(() => Job)
export class JobsResolver {
  constructor(private readonly jobsService: JobsService) {}

  @Mutation(() => Job, { description: 'Create a new job' })
  async createJob(@Args('input') createJobDto: CreateJobDto): Promise<Job> {
    return this.jobsService.create(createJobDto);
  }

  @Query(() => [Job], {
    name: 'jobs',
    description: 'Get all jobs, optionally filtered by status, priority, billing, or date range',
  })
  async findAll(
    @Args('status', { nullable: true, description: 'Filter by status' })
    status?: string,
    @Args('priority', { nullable: true, description: 'Filter by priority' })
    priority?: string,
    @Args('billingStatus', { nullable: true, description: 'Filter by billing status' })
    billingStatus?: string,
    @Args('startDate', { nullable: true, description: 'Filter by start date' })
    startDate?: Date,
    @Args('endDate', { nullable: true, description: 'Filter by end date' })
    endDate?: Date,
  ): Promise<Job[]> {
    return this.jobsService.findAll(status, priority, billingStatus, startDate, endDate);
  }

  @Query(() => Job, {
    name: 'job',
    description: 'Get a single job by ID',
  })
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<Job> {
    return this.jobsService.findOne(id);
  }

  @Query(() => [Job], {
    name: 'pendingJobs',
    description: 'Get all pending jobs',
  })
  async findPending(): Promise<Job[]> {
    return this.jobsService.findPending();
  }

  @Mutation(() => Job, { description: 'Update a job' })
  async updateJob(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') updateJobDto: UpdateJobDto,
  ): Promise<Job> {
    return this.jobsService.update(id, updateJobDto);
  }

  @Mutation(() => Boolean, { description: 'Delete a job (soft delete)' })
  async deleteJob(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    await this.jobsService.remove(id);
    return true;
  }

  @Query(() => [Job], {
    name: 'jobHistory',
    description: 'Get jobs within a date range',
  })
  async findHistory(
    @Args('start', { description: 'Start date' }) start: Date,
    @Args('end', { description: 'End date' }) end: Date,
  ): Promise<Job[]> {
    return this.jobsService.findHistory(start, end);
  }

  @Query(() => [Job], {
    name: 'customerJobHistory',
    description: 'Get all jobs for a specific customer',
  })
  async findCustomerHistory(
    @Args('customerId', { type: () => ID }) customerId: string,
  ): Promise<Job[]> {
    return this.jobsService.findCustomerHistory(customerId);
  }

  @Query(() => [Job], {
    name: 'archivedJobs',
    description: 'Get all archived jobs',
  })
  async findArchived(): Promise<Job[]> {
    return this.jobsService.findArchived();
  }

  @Mutation(() => Job, { description: 'Update billing information for a job' })
  async updateJobBilling(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') updateBillingDto: UpdateBillingDto,
  ): Promise<Job> {
    return this.jobsService.updateBilling(id, updateBillingDto);
  }

  @Mutation(() => Job, { description: 'Update lifecycle status for a job' })
  async updateJobLifecycle(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') updateLifecycleDto: UpdateLifecycleDto,
  ): Promise<Job> {
    return this.jobsService.updateLifecycle(id, updateLifecycleDto);
  }

  @Mutation(() => Job, { description: 'Clone a job' })
  async cloneJob(@Args('id', { type: () => ID }) id: string): Promise<Job> {
    return this.jobsService.cloneJob(id);
  }
}
