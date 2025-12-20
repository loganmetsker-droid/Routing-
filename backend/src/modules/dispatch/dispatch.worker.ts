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
    this.logger.log('🔄 Running auto-dispatch worker');

    try {
      // 1. Get pending jobs (prioritize urgent/high priority)
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
        .limit(50) // Process max 50 jobs per cycle
        .getMany();

      if (pendingJobs.length === 0) {
        this.logger.debug('No pending jobs to dispatch');
        return;
      }

      this.logger.log(`Found ${pendingJobs.length} pending jobs`);

      // 2. Get available vehicles
      const availableVehicles = await this.vehicleRepository.find({
        where: { status: 'available' },
        take: 10, // Max 10 vehicles per cycle
      });

      if (availableVehicles.length === 0) {
        this.logger.warn('No available vehicles for dispatch');
        return;
      }

      this.logger.log(`Found ${availableVehicles.length} available vehicles`);

      // 3. Group jobs for each vehicle (simple round-robin for MVP)
      const jobsPerVehicle = Math.ceil(
        pendingJobs.length / availableVehicles.length,
      );

      let jobIndex = 0;
      const dispatchedRoutes = [];

      for (const vehicle of availableVehicles) {
        // Get next batch of jobs for this vehicle
        const vehicleJobs = pendingJobs.slice(
          jobIndex,
          jobIndex + jobsPerVehicle,
        );

        if (vehicleJobs.length === 0) break;

        try {
          // 4. Call routing service to optimize route
          this.logger.log(
            `Creating optimized route for vehicle ${vehicle.id} with ${vehicleJobs.length} jobs`,
          );

          const route = await this.dispatchService.create({
            vehicleId: vehicle.id,
            jobIds: vehicleJobs.map((j) => j.id),
          });

          // 5. Start the route (updates vehicle status to "in_route")
          const startedRoute = await this.dispatchService.startRoute(route.id);

          dispatchedRoutes.push(startedRoute);

          this.logger.log(
            `✅ Route ${startedRoute.id} created and started for vehicle ${vehicle.id}`,
          );

          // 6. Emit WebSocket event for real-time updates
          this.dispatchGateway.emitRouteCreated(startedRoute);
          this.dispatchGateway.emitVehicleStatusUpdate({
            vehicleId: vehicle.id,
            status: 'in_route',
            routeId: startedRoute.id,
          });

          jobIndex += vehicleJobs.length;
        } catch (error) {
          this.logger.error(
            `Failed to create route for vehicle ${vehicle.id}: ${error.message}`,
            error.stack,
          );
          // Continue with next vehicle even if this one fails
        }
      }

      this.logger.log(
        `✅ Auto-dispatch complete. Created ${dispatchedRoutes.length} routes`,
      );
    } catch (error) {
      this.logger.error(
        `Auto-dispatch worker failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manual trigger for testing
   */
  async manualDispatch(): Promise<void> {
    this.logger.log('🔧 Manual dispatch triggered');
    await this.handleAutoDispatch();
  }
}
