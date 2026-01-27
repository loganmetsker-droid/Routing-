import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Job, JobStatus, JobPriority } from '../jobs/entities/job.entity';
import { DispatchService } from './dispatch.service';
import { DispatchGateway } from './dispatch.gateway';

@Injectable()
export class DispatchWorker {
  private readonly logger = new Logger(DispatchWorker.name);

  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    private readonly dispatchService: DispatchService,
    private readonly dispatchGateway: DispatchGateway,
  ) {}

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
    const startTime = Date.now();
    this.logger.log('🔄 [DISPATCH:START] Auto-dispatch worker initiated');

    try {
      // Step 1: Query pending jobs
      this.logger.log('[DISPATCH:STEP1] Querying pending jobs from database...');
      const pendingJobs = await this.jobRepository
        .createQueryBuilder('job')
        .where('job.status = :status', { status: JobStatus.PENDING })
        .andWhere('job.assigned_route_id IS NULL')
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
        return { success: true, message: 'No pending jobs to dispatch', routesCreated: 0 };
      }

      this.logger.log(
        `[DISPATCH:STEP1] Found ${pendingJobs.length} pending jobs: [${pendingJobs.map(j => j.id.substring(0, 8)).join(', ')}]`,
      );

      // Step 2: Query available vehicles
      this.logger.log('[DISPATCH:STEP2] Querying available vehicles...');
      const availableVehicles = await this.vehicleRepository.find({
        where: { status: 'available' },
        take: 10,
      });

      if (availableVehicles.length === 0) {
        this.logger.warn('[DISPATCH:STEP2] No available vehicles found - cannot dispatch');
        return {
          success: false,
          error: 'NO_AVAILABLE_VEHICLES',
          message: 'No vehicles with status "available" found for dispatch',
          pendingJobCount: pendingJobs.length,
        };
      }

      this.logger.log(
        `[DISPATCH:STEP2] Found ${availableVehicles.length} available vehicles: [${availableVehicles.map(v => v.id.substring(0, 8)).join(', ')}]`,
      );

      // Step 3: Distribute jobs across vehicles
      this.logger.log('[DISPATCH:STEP3] Distributing jobs across vehicles...');
      const jobsPerVehicle = Math.ceil(pendingJobs.length / availableVehicles.length);
      this.logger.log(`[DISPATCH:STEP3] Jobs per vehicle (target): ${jobsPerVehicle}`);

      let jobIndex = 0;
      const dispatchedRoutes = [];
      const failedVehicles = [];

      for (const vehicle of availableVehicles) {
        const vehicleJobs = pendingJobs.slice(jobIndex, jobIndex + jobsPerVehicle);

        if (vehicleJobs.length === 0) {
          this.logger.debug(`[DISPATCH:STEP3] No more jobs to assign to vehicle ${vehicle.id.substring(0, 8)}`);
          break;
        }

        this.logger.log(
          `[DISPATCH:STEP4] Creating route for vehicle ${vehicle.id.substring(0, 8)} with ${vehicleJobs.length} jobs`,
        );

        try {
          // Step 4: Create optimized route via routing service
          this.logger.log(
            `[DISPATCH:STEP4] Invoking DispatchService.create() for vehicle ${vehicle.id.substring(0, 8)}...`,
          );
          const route = await this.dispatchService.create({
            vehicleId: vehicle.id,
            jobIds: vehicleJobs.map((j) => j.id),
          });
          this.logger.log(
            `[DISPATCH:STEP4] Route ${route.id.substring(0, 8)} created successfully`,
          );

          // Step 5: Start the route
          this.logger.log(`[DISPATCH:STEP5] Starting route ${route.id.substring(0, 8)}...`);
          const startedRoute = await this.dispatchService.startRoute(route.id);
          this.logger.log(
            `[DISPATCH:STEP5] Route ${startedRoute.id.substring(0, 8)} started - vehicle status updated to "in_route"`,
          );

          dispatchedRoutes.push(startedRoute);

          // Step 6: Emit WebSocket events
          this.logger.log(`[DISPATCH:STEP6] Emitting WebSocket events for route ${startedRoute.id.substring(0, 8)}...`);
          this.dispatchGateway.emitRouteCreated(startedRoute);
          this.dispatchGateway.emitVehicleStatusUpdate({
            vehicleId: vehicle.id,
            status: 'in_route',
            routeId: startedRoute.id,
          });
          this.logger.log(`[DISPATCH:STEP6] WebSocket events emitted successfully`);

          jobIndex += vehicleJobs.length;
        } catch (error) {
          const errorDetails = {
            vehicleId: vehicle.id,
            jobIds: vehicleJobs.map((j) => j.id),
            errorType: error.constructor.name,
            errorMessage: error.message,
          };
          this.logger.error(
            `[DISPATCH:ERROR] Failed to create route for vehicle ${vehicle.id.substring(0, 8)}: ${error.message}`,
            JSON.stringify(errorDetails),
          );
          failedVehicles.push(errorDetails);
          // Continue with next vehicle
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `[DISPATCH:COMPLETE] Auto-dispatch finished in ${duration}ms. Routes created: ${dispatchedRoutes.length}, Failed: ${failedVehicles.length}`,
      );

      return {
        success: true,
        routesCreated: dispatchedRoutes.length,
        routeIds: dispatchedRoutes.map((r) => r.id),
        failedVehicles: failedVehicles.length > 0 ? failedVehicles : undefined,
        durationMs: duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `[DISPATCH:FATAL] Auto-dispatch worker failed after ${duration}ms: ${error.message}`,
        error.stack,
      );
      throw new Error(`Auto-dispatch failed: ${error.message}`);
    }
  }

  /**
   * Manual trigger for testing - returns dispatch result
   */
  async manualDispatch(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    routesCreated?: number;
    routeIds?: string[];
    failedVehicles?: any[];
    durationMs?: number;
    pendingJobCount?: number;
  }> {
    this.logger.log('🔧 [DISPATCH:MANUAL] Manual dispatch triggered via API');
    const result = await this.handleAutoDispatch();
    return result || { success: true, message: 'Dispatch completed', routesCreated: 0 };
  }
}
