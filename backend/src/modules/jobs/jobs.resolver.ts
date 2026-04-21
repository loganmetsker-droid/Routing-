import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { JobsService } from './jobs.service';
import { Job } from './entities/job.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { UpdateBillingDto } from './dto/update-billing.dto';
import { UpdateLifecycleDto } from './dto/update-lifecycle.dto';

type GraphqlContext = {
  req?: {
    user?: {
      userId?: string;
      organizationId?: string;
    };
  };
};

@Resolver(() => Job)
export class JobsResolver {
  constructor(private readonly jobsService: JobsService) {}

  private actor(ctx: GraphqlContext) {
    return ctx?.req?.user;
  }

  @Mutation(() => Job, { description: 'Create a new job' })
  async createJob(
    @Context() ctx: GraphqlContext,
    @Args('input') createJobDto: CreateJobDto,
  ): Promise<Job> {
    return this.jobsService.create(createJobDto, this.actor(ctx));
  }

  @Query(() => [Job], {
    name: 'jobs',
    description: 'Get all jobs, optionally filtered by status, priority, billing, or date range',
  })
  async findAll(
    @Context() ctx: GraphqlContext,
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
    return this.jobsService.findAll(status, priority, billingStatus, startDate, endDate, this.actor(ctx));
  }

  @Query(() => Job, {
    name: 'job',
    description: 'Get a single job by ID',
  })
  async findOne(
    @Context() ctx: GraphqlContext,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Job> {
    return this.jobsService.findOne(id, this.actor(ctx));
  }

  @Query(() => [Job], {
    name: 'pendingJobs',
    description: 'Get all pending jobs',
  })
  async findPending(@Context() ctx: GraphqlContext): Promise<Job[]> {
    return this.jobsService.findPending(this.actor(ctx));
  }

  @Mutation(() => Job, { description: 'Update a job' })
  async updateJob(
    @Context() ctx: GraphqlContext,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') updateJobDto: UpdateJobDto,
  ): Promise<Job> {
    return this.jobsService.update(id, updateJobDto, this.actor(ctx));
  }

  @Mutation(() => Boolean, { description: 'Delete a job (soft delete)' })
  async deleteJob(
    @Context() ctx: GraphqlContext,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.jobsService.remove(id, this.actor(ctx));
    return true;
  }

  @Query(() => [Job], {
    name: 'jobHistory',
    description: 'Get jobs within a date range',
  })
  async findHistory(
    @Context() ctx: GraphqlContext,
    @Args('start', { description: 'Start date' }) start: Date,
    @Args('end', { description: 'End date' }) end: Date,
  ): Promise<Job[]> {
    return this.jobsService.findHistory(start, end, this.actor(ctx));
  }

  @Query(() => [Job], {
    name: 'customerJobHistory',
    description: 'Get all jobs for a specific customer',
  })
  async findCustomerHistory(
    @Context() ctx: GraphqlContext,
    @Args('customerId', { type: () => ID }) customerId: string,
  ): Promise<Job[]> {
    return this.jobsService.findCustomerHistory(customerId, this.actor(ctx));
  }

  @Query(() => [Job], {
    name: 'archivedJobs',
    description: 'Get all archived jobs',
  })
  async findArchived(@Context() ctx: GraphqlContext): Promise<Job[]> {
    return this.jobsService.findArchived(this.actor(ctx));
  }

  @Mutation(() => Job, { description: 'Update billing information for a job' })
  async updateJobBilling(
    @Context() ctx: GraphqlContext,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') updateBillingDto: UpdateBillingDto,
  ): Promise<Job> {
    return this.jobsService.updateBilling(id, updateBillingDto, this.actor(ctx));
  }

  @Mutation(() => Job, { description: 'Update lifecycle status for a job' })
  async updateJobLifecycle(
    @Context() ctx: GraphqlContext,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') updateLifecycleDto: UpdateLifecycleDto,
  ): Promise<Job> {
    return this.jobsService.updateLifecycle(id, updateLifecycleDto, this.actor(ctx));
  }

  @Mutation(() => Job, { description: 'Clone a job' })
  async cloneJob(
    @Context() ctx: GraphqlContext,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Job> {
    return this.jobsService.cloneJob(id, this.actor(ctx));
  }
}
