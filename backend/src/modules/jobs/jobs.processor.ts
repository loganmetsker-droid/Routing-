import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job as JobEntity, JobStatus } from './entities/job.entity';
import { Route, RouteStatus } from '../dispatch/entities/route.entity';

@Processor('jobs')
export class JobsProcessor {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(
    @InjectRepository(JobEntity)
    private readonly jobsRepository: Repository<JobEntity>,
    @InjectRepository(Route)
    private readonly routesRepository: Repository<Route>,
  ) {}

  @Process('process-job')
  async handleJobProcessing(job: Job) {
    this.logger.log(`Processing job ${job.data.jobId}`);
    this.logger.debug(`Job data: ${JSON.stringify(job.data)}`);

    try {
      // Update progress
      await job.progress(10);

      // Simulate job processing (in real implementation, this would:
      // - Assign job to optimal route
      // - Notify drivers
      // - Update job status
      // - Send customer notifications
      // etc.)

      await job.progress(50);

      // Simulate async processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await job.progress(100);

      this.logger.log(`Successfully processed job ${job.data.jobId}`);

      return {
        success: true,
        jobId: job.data.jobId,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to process job ${job.data.jobId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process('assign-to-route')
  async handleRouteAssignment(job: Job) {
    this.logger.log(`Assigning job ${job.data.jobId} to route`);

    const queuedJob = await this.jobsRepository.findOne({
      where: { id: job.data.jobId },
    });
    if (!queuedJob) {
      throw new Error(`Queued job not found: ${job.data.jobId}`);
    }

    const candidateRoutes = await this.routesRepository.find({
      where: {
        ...(queuedJob.organizationId ? { organizationId: queuedJob.organizationId } : {}),
      } as any,
      order: { createdAt: 'ASC' },
    });

    const openRoutes = candidateRoutes
      .filter((route) =>
        [RouteStatus.PLANNED, RouteStatus.ASSIGNED].includes(route.status),
      )
      .sort((left, right) => (left.jobCount || left.jobIds?.length || 0) - (right.jobCount || right.jobIds?.length || 0));

    const targetRoute = openRoutes[0];
    if (!targetRoute) {
      this.logger.warn(`No open route available for queued job ${queuedJob.id}`);
      return {
        success: false,
        jobId: queuedJob.id,
        reason: 'no-open-route-available',
      };
    }

    const nextJobIds = Array.from(
      new Set([...(targetRoute.jobIds || []), queuedJob.id]),
    );
    targetRoute.jobIds = nextJobIds;
    targetRoute.jobCount = nextJobIds.length;
    await this.routesRepository.save(targetRoute);

    queuedJob.assignedRouteId = targetRoute.id;
    queuedJob.status = JobStatus.SCHEDULED;
    await this.jobsRepository.save(queuedJob);

    return {
      success: true,
      jobId: queuedJob.id,
      routeId: targetRoute.id,
      assignedAt: new Date().toISOString(),
    };
  }
}
