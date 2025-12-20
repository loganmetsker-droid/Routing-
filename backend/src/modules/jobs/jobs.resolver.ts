import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { JobsService } from './jobs.service';
import { Job } from './entities/job.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

@Resolver(() => Job)
export class JobsResolver {
  constructor(private readonly jobsService: JobsService) {}

  @Mutation(() => Job, { description: 'Create a new job' })
  async createJob(@Args('input') createJobDto: CreateJobDto): Promise<Job> {
    return this.jobsService.create(createJobDto);
  }

  @Query(() => [Job], {
    name: 'jobs',
    description: 'Get all jobs, optionally filtered by status or priority',
  })
  async findAll(
    @Args('status', { nullable: true, description: 'Filter by status' })
    status?: string,
    @Args('priority', { nullable: true, description: 'Filter by priority' })
    priority?: string,
  ): Promise<Job[]> {
    return this.jobsService.findAll(status, priority);
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
}
