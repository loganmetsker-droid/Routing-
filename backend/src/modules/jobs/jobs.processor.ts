import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job as JobEntity, JobStatus } from './entities/job.entity';
import { Route, RouteStatus } from '../dispatch/entities/route.entity';
import { summarizeBullJobDataForLog } from '../../common/logging/bull-job-log.util';

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
    const summary = summarizeBullJobDataForLog(job.data);
    this.logger.log(`Processing job ${summary.jobId || 'unknown'}`);
    this.logger.debug(`Job data summary: ${JSON.stringify(summary)}`);

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

      this.logger.log(
        `Successfully processed job ${summary.jobId || 'unknown'}`,
      );

      return {
        success: true,
        jobId: summary.jobId,
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process job ${summary.jobId || 'unknown'}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @Process('assign-to-route')
  async handleRouteAssignment(job: Job) {
    const summary = summarizeBullJobDataForLog(job.data);
    this.logger.log(`Assigning job ${summary.jobId || 'unknown'} to route`);
    this.logger.debug(`Job data summary: ${JSON.stringify(summary)}`);

    const queuedJob = await this.jobsRepository.findOne({
      where: { id: job.data.jobId },
    });
    if (!queuedJob) {
      throw new Error(`Queued job not found: ${summary.jobId || 'unknown'}`);
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
