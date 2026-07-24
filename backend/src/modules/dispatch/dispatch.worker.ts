import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Job, JobStatus, JobPriority } from '../jobs/entities/job.entity';
import { DispatchService } from './dispatch.service';
import { DispatchGateway } from './dispatch.gateway';
import { RuntimeStatusService } from '../../common/runtime/runtime-status.service';
import {
  normalizeOptimizationObjective,
  type OptimizationObjective,
} from '../../../../shared/contracts';
import type { DispatchActorContext } from './dispatch.types';

type AutoDispatchFailure = {
  organizationId: string | null;
  vehicleId: string | null;
  jobIds: string[];
  errorType: string;
  errorMessage: string;
};

type AutoDispatchResult = {
  success: boolean;
  message?: string;
  error?: string;
  routesCreated?: number;
  routeIds?: string[];
  failedVehicles?: AutoDispatchFailure[];
  durationMs?: number;
  pendingJobCount?: number;
};

@Injectable()
export class DispatchWorker implements OnModuleInit {
  private readonly logger = new Logger(DispatchWorker.name);

  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    private readonly configService: ConfigService,
    private readonly dispatchService: DispatchService,
    private readonly dispatchGateway: DispatchGateway,
    private readonly runtimeStatusService: RuntimeStatusService,
  ) {}

  onModuleInit() {
    this.runtimeStatusService.registerWorker();
  }

  private resolveOptimizationObjective(
    objective?: string | null,
  ): OptimizationObjective {
    return normalizeOptimizationObjective(
      objective ||
        this.configService.get<string>('ROUTE_OPTIMIZATION_DEFAULT_OBJECTIVE') ||
        'distance',
    );
  }

  /**
   * Auto-dispatch worker that runs every minute
   * 1. Finds pending jobs from the queue
   * 2. Finds available vehicles
   * 3. Calls routing-service to optimize routes
   * 4. Creates route entities
   * 5. Updates vehicle status
   * 6. Emits WebSocket events
   */
  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'auto-dispatch',
    timeZone: 'UTC',
  })
  async handleAutoDispatch() {
    return this.runAutoDispatch(this.resolveOptimizationObjective());
  }

  private async runAutoDispatch(
    objective: OptimizationObjective,
    organizationId?: string | null,
  ) {
    const startTime = Date.now();
    this.runtimeStatusService.markWorkerRunStarted();
    this.logger.log('🔄 [DISPATCH:START] Auto-dispatch worker initiated');

    try {
      // Step 1: Query pending jobs
      this.logger.log('[DISPATCH:STEP1] Querying pending jobs from database...');
      const pendingJobsQuery = this.jobRepository
        .createQueryBuilder('job')
        .where('job.status = :status', { status: JobStatus.PENDING })
        .andWhere('job.assigned_route_id IS NULL');
      if (organizationId) {
        pendingJobsQuery.andWhere('job.organization_id = :organizationId', {
          organizationId,
        });
      }
      const pendingJobs = await pendingJobsQuery
        .orderBy(
          `CASE
            WHEN job.priority = '${JobPriority.URGENT}' THEN 1
            WHEN job.priority = '${JobPriority.HIGH}' THEN 2
            WHEN job.priority = '${JobPriority.NORMAL}' THEN 3
            ELSE 4
          END`,
        )
        .addOrderBy('job.time_window_start', 'ASC')
        .limit(50)
        .getMany();

      if (pendingJobs.length === 0) {
        this.logger.debug('[DISPATCH:STEP1] No pending jobs found - skipping dispatch cycle');
        const duration = Date.now() - startTime;
        this.runtimeStatusService.markWorkerRunCompleted(duration);
        return {
          success: true,
          message: 'No pending jobs to dispatch',
          routesCreated: 0,
          durationMs: duration,
        };
      }

      this.logger.log(
        `[DISPATCH:STEP1] Found ${pendingJobs.length} pending jobs: [${pendingJobs.map(j => j.id.substring(0, 8)).join(', ')}]`,
      );

      // Step 2: Distribute jobs within strict organization boundaries.
      // Tenantless legacy rows are never assigned automatically because doing so
      // could attach customer work to the wrong fleet.
      this.logger.log('[DISPATCH:STEP2] Distributing jobs across tenant-scoped vehicles...');
      const dispatchedRoutes = [];
      const failures: AutoDispatchFailure[] = [];
      const tenantJobs = pendingJobs.filter((job) => Boolean(job.organizationId));
      const orphanJobs = pendingJobs.filter((job) => !job.organizationId);
      if (orphanJobs.length > 0) {
        failures.push({
          organizationId: null,
          vehicleId: null,
          jobIds: orphanJobs.map((job) => job.id),
          errorType: 'ORPHANED_PENDING_JOBS',
          errorMessage:
            'Pending jobs without an organization were skipped to prevent cross-tenant assignment.',
        });
      }

      const organizationIds = Array.from(
        new Set(tenantJobs.map((job) => job.organizationId as string)),
      );
      for (const tenantId of organizationIds) {
        const organizationJobs = tenantJobs.filter(
          (job) => job.organizationId === tenantId,
        );
        const organizationVehicles = await this.vehicleRepository.find({
          where: {
            status: 'available',
            organizationId: tenantId,
          },
          take: 10,
        });

        if (organizationVehicles.length === 0) {
          failures.push({
            organizationId: tenantId,
            vehicleId: null,
            jobIds: organizationJobs.map((job) => job.id),
            errorType: 'NO_AVAILABLE_VEHICLES',
            errorMessage:
              'No available vehicles were found in the pending jobs organization.',
          });
          continue;
        }

        const jobsPerVehicle = Math.ceil(
          organizationJobs.length / organizationVehicles.length,
        );
        let jobIndex = 0;
        const actor: DispatchActorContext = {
          userId: 'system:auto-dispatch',
          organizationId: tenantId,
          roles: ['SYSTEM'],
        };

        for (const vehicle of organizationVehicles) {
          const vehicleJobs = organizationJobs.slice(
            jobIndex,
            jobIndex + jobsPerVehicle,
          );
          if (vehicleJobs.length === 0) break;

          this.logger.log(
            `[DISPATCH:STEP3] Creating route for organization ${tenantId.substring(0, 8)} and vehicle ${vehicle.id.substring(0, 8)} with ${vehicleJobs.length} jobs`,
          );

          try {
            const route = await this.dispatchService.create(
              {
                vehicleId: vehicle.id,
                jobIds: vehicleJobs.map((job) => job.id),
                objective,
              },
              actor,
            );
            const startedRoute = await this.dispatchService.startRoute(
              route.id,
              actor,
            );
            dispatchedRoutes.push(startedRoute);
            this.dispatchGateway.emitRouteCreated(startedRoute);
            this.dispatchGateway.emitVehicleStatusUpdate({
              vehicleId: vehicle.id,
              status: 'in_route',
              routeId: startedRoute.id,
              organizationId: tenantId,
            });
            jobIndex += vehicleJobs.length;
          } catch (error: unknown) {
            const errorType =
              error instanceof Error ? error.constructor.name : 'UnknownError';
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            const errorDetails: AutoDispatchFailure = {
              organizationId: tenantId,
              vehicleId: vehicle.id,
              jobIds: vehicleJobs.map((job) => job.id),
              errorType,
              errorMessage,
            };
            this.logger.error(
              `[DISPATCH:ERROR] Failed to create route for organization ${tenantId.substring(0, 8)} and vehicle ${vehicle.id.substring(0, 8)}: ${errorMessage}`,
              JSON.stringify(errorDetails),
            );
            failures.push(errorDetails);
          }
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `[DISPATCH:COMPLETE] Auto-dispatch finished in ${duration}ms. Routes created: ${dispatchedRoutes.length}, Failed: ${failures.length}`,
      );
      if (failures.length > 0) {
        this.runtimeStatusService.markWorkerRunFailed(
          `${failures.length} tenant-scoped dispatch batch${failures.length === 1 ? '' : 'es'} failed`,
          duration,
        );
      } else {
        this.runtimeStatusService.markWorkerRunCompleted(duration);
      }

      return {
        success: failures.length === 0,
        error: failures.length > 0 ? 'AUTO_DISPATCH_PARTIAL_FAILURE' : undefined,
        routesCreated: dispatchedRoutes.length,
        routeIds: dispatchedRoutes.map((r) => r.id),
        failedVehicles: failures.length > 0 ? failures : undefined,
        durationMs: duration,
        pendingJobCount: pendingJobs.length,
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.runtimeStatusService.markWorkerRunFailed(errorMessage, duration);
      this.logger.error(
        `[DISPATCH:FATAL] Auto-dispatch worker failed after ${duration}ms: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(`Auto-dispatch failed: ${errorMessage}`);
    }
  }

  /**
   * Manual trigger for testing - returns dispatch result
   */
  async manualDispatch(
    objective?: string | null,
    organizationId?: string | null,
  ): Promise<AutoDispatchResult> {
    this.logger.log('🔧 [DISPATCH:MANUAL] Manual dispatch triggered via API');
    if (!organizationId) {
      throw new Error('Manual dispatch requires an organization context');
    }
    this.runtimeStatusService.touchWorkerHeartbeat();
    const result = await this.runAutoDispatch(
      this.resolveOptimizationObjective(objective),
      organizationId,
    );
    return (
      result || {
        success: true,
        message: 'Dispatch completed',
        routesCreated: 0,
      }
    );
  }
}
