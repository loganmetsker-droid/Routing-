import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Route, RouteStatus } from './entities/route.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Job, JobStatus } from '../jobs/entities/job.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import {
  RoutingServiceRequest,
  RoutingServiceResponse,
} from './dto/routing-service.dto';
import { DispatchGateway } from './dispatch.gateway';

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);
  private readonly routingServiceUrl: string;

  // Predefined color palette for route visualization
  private readonly routeColors = [
    '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FFD700',
    '#00CED1', '#FF6347', '#32CD32', '#BA55D3', '#FF8C00',
    '#4169E1', '#DC143C', '#00FA9A', '#FF1493', '#1E90FF',
  ];

  private routeColorIndex = 0;

  constructor(
    @InjectRepository(Route)
    private readonly routeRepository: Repository<Route>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => DispatchGateway))
    private readonly dispatchGateway: DispatchGateway,
  ) {
    this.routingServiceUrl = this.configService.get<string>(
      'ROUTING_SERVICE_URL',
      'http://localhost:8000',
    );
  }

  /**
   * Get next available route color
   */
  private getNextRouteColor(): string {
    const color = this.routeColors[this.routeColorIndex];
    this.routeColorIndex = (this.routeColorIndex + 1) % this.routeColors.length;
    return color;
  }

  /**
   * Generate polyline from job locations
   * If routing service provides polyline, use it; otherwise create from job coordinates
   */
  private async generatePolyline(
    jobIds: string[],
    routingResponse: RoutingServiceResponse,
  ): Promise<any> {
    // Check if routing service returned polyline geometry
    if (routingResponse.polyline) {
      return routingResponse.polyline;
    }

    // Otherwise, generate simple polyline from job locations
    const jobs = await this.jobRepository.findByIds(jobIds);

    const coordinates = [];
    for (const job of jobs) {
      // Add pickup location
      if (job.pickupLocation) {
        coordinates.push([job.pickupLocation.lng, job.pickupLocation.lat]);
      }
      // Add delivery location
      if (job.deliveryLocation) {
        coordinates.push([job.deliveryLocation.lng, job.deliveryLocation.lat]);
      }
    }

    // Return as GeoJSON LineString
    return {
      type: 'LineString',
      coordinates,
    };
  }

  /**
   * Call the Python routing-service to optimize route
   */
  async callRoutingService(
    vehicleId: string,
    jobIds: string[],
  ): Promise<RoutingServiceResponse> {
    const requestUrl = `${this.routingServiceUrl}/route`;
    this.logger.log(
      `[ROUTING:REQUEST] Calling routing service at ${requestUrl} for vehicle ${vehicleId.substring(0, 8)} with ${jobIds.length} jobs`,
    );

    const request: RoutingServiceRequest = {
      vehicle_id: vehicleId,
      job_ids: jobIds,
    };

    try {
      this.logger.debug(`[ROUTING:REQUEST] Payload: ${JSON.stringify(request)}`);
      const startTime = Date.now();

      const response: any = await firstValueFrom(
        this.httpService.post<RoutingServiceResponse>(
          requestUrl,
          request,
          { timeout: 30000 }, // 30 second timeout
        ) as any,
      );

      const duration = Date.now() - startTime;
      const data = response?.data as RoutingServiceResponse;

      this.logger.log(
        `[ROUTING:RESPONSE] Received response in ${duration}ms - success: ${data?.success}`,
      );

      if (!data) {
        throw new BadRequestException(
          `ROUTING_SERVICE_EMPTY_RESPONSE: Routing service returned empty response`,
        );
      }

      if (!data.success) {
        throw new BadRequestException(
          `ROUTING_OPTIMIZATION_FAILED: ${data.error || 'Unknown routing error'}`,
        );
      }

      this.logger.log(
        `[ROUTING:SUCCESS] Route optimized - distance: ${data.total_distance_km}km, duration: ${data.total_duration_minutes}min, stops: ${data.num_jobs}`,
      );

      return data;
    } catch (error) {
      // Categorize errors for better debugging
      let errorCode = 'ROUTING_SERVICE_ERROR';
      let errorMessage = error.message;

      if (error.code === 'ECONNREFUSED') {
        errorCode = 'ROUTING_SERVICE_UNAVAILABLE';
        errorMessage = `Routing service is not running at ${this.routingServiceUrl}`;
      } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        errorCode = 'ROUTING_SERVICE_TIMEOUT';
        errorMessage = `Routing service timed out after 30 seconds`;
      } else if (error.response?.status === 404) {
        errorCode = 'ROUTING_ENDPOINT_NOT_FOUND';
        errorMessage = `Routing endpoint ${requestUrl} not found`;
      } else if (error.response?.status >= 500) {
        errorCode = 'ROUTING_SERVICE_INTERNAL_ERROR';
        errorMessage = `Routing service internal error: ${error.response?.data?.message || error.message}`;
      }

      this.logger.error(
        `[ROUTING:ERROR] ${errorCode}: ${errorMessage}`,
        error.stack,
      );

      throw new BadRequestException(`${errorCode}: ${errorMessage}`);
    }
  }

  /**
   * Create a new route with optimization
   */
  async create(createRouteDto: CreateRouteDto): Promise<Route> {
    const startTime = Date.now();
    this.logger.log(
      `[ROUTE:CREATE] Starting route creation for vehicle ${createRouteDto.vehicleId.substring(0, 8)} with ${createRouteDto.jobIds.length} jobs`,
    );

    // Step 1: Validate vehicle exists
    this.logger.log(`[ROUTE:CREATE:STEP1] Validating vehicle ${createRouteDto.vehicleId.substring(0, 8)}...`);
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: createRouteDto.vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException(
        `VEHICLE_NOT_FOUND: Vehicle with ID ${createRouteDto.vehicleId} does not exist`,
      );
    }
    this.logger.log(`[ROUTE:CREATE:STEP1] Vehicle found: ${vehicle.licensePlate || vehicle.id.substring(0, 8)} (status: ${vehicle.status})`);

    // Step 2: Validate jobs exist and are pending
    this.logger.log(`[ROUTE:CREATE:STEP2] Validating ${createRouteDto.jobIds.length} jobs...`);
    const jobs = await this.jobRepository.findByIds(createRouteDto.jobIds);

    if (jobs.length !== createRouteDto.jobIds.length) {
      const foundIds = jobs.map((j) => j.id);
      const missingIds = createRouteDto.jobIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `JOBS_NOT_FOUND: ${missingIds.length} job(s) not found: [${missingIds.map(id => id.substring(0, 8)).join(', ')}]`,
      );
    }

    const nonPendingJobs = jobs.filter(
      (job) => job.status !== JobStatus.PENDING,
    );
    if (nonPendingJobs.length > 0) {
      throw new BadRequestException(
        `JOBS_INVALID_STATUS: ${nonPendingJobs.length} job(s) not in 'pending' status: [${nonPendingJobs.map((j) => `${j.id.substring(0, 8)}:${j.status}`).join(', ')}]`,
      );
    }
    this.logger.log(`[ROUTE:CREATE:STEP2] All ${jobs.length} jobs validated successfully`);

    // Step 3: Call routing service for optimization
    this.logger.log(`[ROUTE:CREATE:STEP3] Calling routing service for route optimization...`);
    const routingResponse = await this.callRoutingService(
      createRouteDto.vehicleId,
      createRouteDto.jobIds,
    );

    // Step 4: Extract optimized job order
    this.logger.log(`[ROUTE:CREATE:STEP4] Extracting optimized job order...`);
    const optimizedJobIds = routingResponse.route.map((r) => r.job_id);
    this.logger.log(`[ROUTE:CREATE:STEP4] Optimized order: [${optimizedJobIds.map(id => id.substring(0, 8)).join(' -> ')}]`);

    // Step 5: Generate polyline geometry
    this.logger.log(`[ROUTE:CREATE:STEP5] Generating polyline geometry...`);
    const polyline = await this.generatePolyline(
      optimizedJobIds,
      routingResponse,
    );

    // Assign a color for route visualization
    const color = this.getNextRouteColor();

    // Calculate ETA (planned start + duration)
    let eta: Date | null = null;
    if (createRouteDto.plannedStart && routingResponse.total_duration_minutes) {
      const startTime = new Date(createRouteDto.plannedStart);
      eta = new Date(
        startTime.getTime() + routingResponse.total_duration_minutes * 60000,
      );
    }

    // Step 6: Create and save route entity
    this.logger.log(`[ROUTE:CREATE:STEP6] Saving route entity to database...`);
    const route = this.routeRepository.create({
      vehicleId: createRouteDto.vehicleId,
      driverId: createRouteDto.driverId,
      jobIds: optimizedJobIds,
      routeData: routingResponse,
      status: RouteStatus.PLANNED,
      totalDistanceKm: routingResponse.total_distance_km,
      totalDurationMinutes: routingResponse.total_duration_minutes,
      jobCount: routingResponse.num_jobs,
      polyline,
      color,
      eta,
      plannedStart: createRouteDto.plannedStart
        ? new Date(createRouteDto.plannedStart)
        : null,
      notes: createRouteDto.notes,
    });

    const savedRoute = await this.routeRepository.save(route);

    const duration = Date.now() - startTime;
    this.logger.log(
      `[ROUTE:CREATE:COMPLETE] Route ${savedRoute.id.substring(0, 8)} created in ${duration}ms (color: ${color}, distance: ${routingResponse.total_distance_km}km, stops: ${routingResponse.num_jobs})`,
    );

    // Step 7: Broadcast via WebSocket
    this.logger.log(`[ROUTE:CREATE:STEP7] Broadcasting route creation via WebSocket...`);
    this.dispatchGateway.emitRouteCreated(savedRoute);

    return savedRoute;
  }

  /**
   * Find all routes
   */
  async findAll(status?: RouteStatus): Promise<Route[]> {
    if (status) {
      return this.routeRepository.find({
        where: { status },
        relations: ['vehicle'],
        order: { createdAt: 'DESC' },
      });
    }

    return this.routeRepository.find({
      relations: ['vehicle'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find one route by ID
   */
  async findOne(id: string): Promise<Route> {
    const route = await this.routeRepository.findOne({
      where: { id },
      relations: ['vehicle'],
    });

    if (!route) {
      throw new NotFoundException(`Route ${id} not found`);
    }

    return route;
  }

  /**
   * Update a route
   */
  async update(id: string, updateRouteDto: UpdateRouteDto): Promise<Route> {
    const route = await this.findOne(id);

    Object.assign(route, updateRouteDto);

    return this.routeRepository.save(route);
  }

  /**
   * Start a route (assign to vehicle/driver)
   */
  async startRoute(id: string): Promise<Route> {
    this.logger.log(`[ROUTE:START] Initiating route start for ${id.substring(0, 8)}...`);

    const route = await this.findOne(id);

    if (route.status !== RouteStatus.PLANNED) {
      throw new BadRequestException(
        `ROUTE_INVALID_STATUS: Cannot start route ${id.substring(0, 8)} - must be in 'planned' status but is '${route.status}'`,
      );
    }

    // Step 1: Update route status
    this.logger.log(`[ROUTE:START:STEP1] Updating route status to IN_PROGRESS...`);
    route.status = RouteStatus.IN_PROGRESS;
    route.actualStart = new Date();

    // Step 2: Update vehicle status to "in_route"
    this.logger.log(`[ROUTE:START:STEP2] Updating vehicle ${route.vehicleId.substring(0, 8)} status to "in_route"...`);
    await this.vehicleRepository.update(route.vehicleId, {
      status: 'in_route',
    });

    // Step 3: Update job statuses to "assigned"
    this.logger.log(`[ROUTE:START:STEP3] Updating ${route.jobIds.length} jobs to "assigned" status...`);
    const updateResult = await this.jobRepository
      .createQueryBuilder()
      .update()
      .set({ status: JobStatus.ASSIGNED, assignedRouteId: route.id })
      .where('id IN (:...ids)', { ids: route.jobIds })
      .execute();
    this.logger.log(`[ROUTE:START:STEP3] Updated ${updateResult.affected} jobs`);

    // Step 4: Save route
    this.logger.log(`[ROUTE:START:STEP4] Saving route changes...`);
    const updatedRoute = await this.routeRepository.save(route);

    this.logger.log(
      `[ROUTE:START:COMPLETE] Route ${route.id.substring(0, 8)} started successfully. Vehicle ${route.vehicleId.substring(0, 8)} now in_route with ${route.jobIds.length} assigned jobs`,
    );

    // Step 5: Broadcast via WebSocket
    this.logger.log(`[ROUTE:START:STEP5] Broadcasting route started event...`);
    this.dispatchGateway.emitRouteStarted(updatedRoute);

    return updatedRoute;
  }

  /**
   * Complete a route
   */
  async completeRoute(id: string): Promise<Route> {
    const route = await this.findOne(id);

    if (route.status !== RouteStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Route must be 'in_progress' to complete. Current: ${route.status}`,
      );
    }

    route.status = RouteStatus.COMPLETED;
    route.completedAt = new Date();

    // Update vehicle status back to "available"
    await this.vehicleRepository.update(route.vehicleId, {
      status: 'available',
    });

    const completedRoute = await this.routeRepository.save(route);

    // Broadcast route completion via WebSocket
    this.dispatchGateway.emitRouteCompleted(completedRoute);

    return completedRoute;
  }

  /**
   * Cancel a route
   */
  async cancelRoute(id: string): Promise<Route> {
    const route = await this.findOne(id);

    const wasInProgress = route.status === RouteStatus.IN_PROGRESS;
    route.status = RouteStatus.CANCELLED;

    // Reset vehicle status if in route
    if (wasInProgress) {
      await this.vehicleRepository.update(route.vehicleId, {
        status: 'available',
      });
    }

    // Reset job statuses back to pending
    await this.jobRepository.update(
      { id: route.jobIds as any },
      { status: JobStatus.PENDING, assignedRouteId: null },
    );

    return this.routeRepository.save(route);
  }

  /**
   * Get routes by vehicle
   */
  async findByVehicle(vehicleId: string): Promise<Route[]> {
    return this.routeRepository.find({
      where: { vehicleId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Reorder stops in a route and recalculate polyline
   */
  async reorderStops(routeId: string, newJobOrder: string[]): Promise<Route> {
    this.logger.log(
      `Reordering stops for route ${routeId} with ${newJobOrder.length} jobs`,
    );

    const route = await this.findOne(routeId);

    if (route.status === RouteStatus.COMPLETED || route.status === RouteStatus.CANCELLED) {
      throw new BadRequestException(
        `Cannot reorder stops for ${route.status} route`,
      );
    }

    // Validate that all job IDs belong to this route
    const invalidJobs = newJobOrder.filter((jobId) => !route.jobIds.includes(jobId));
    if (invalidJobs.length > 0) {
      throw new BadRequestException(
        `Invalid job IDs: ${invalidJobs.join(', ')}`,
      );
    }

    if (newJobOrder.length !== route.jobIds.length) {
      throw new BadRequestException(
        'Job count mismatch. All jobs must be included in new order.',
      );
    }

    // Call routing service with new order to get updated polyline and metrics
    const routingResponse = await this.callRoutingService(
      route.vehicleId,
      newJobOrder,
    );

    // Generate new polyline
    const polyline = await this.generatePolyline(newJobOrder, routingResponse);

    // Calculate new ETA
    let eta: Date | null = null;
    if (route.plannedStart && routingResponse.total_duration_minutes) {
      const startTime = new Date(route.plannedStart);
      eta = new Date(
        startTime.getTime() + routingResponse.total_duration_minutes * 60000,
      );
    }

    // Update route with new order and metrics
    route.jobIds = newJobOrder;
    route.polyline = polyline;
    route.totalDistanceKm = routingResponse.total_distance_km;
    route.totalDurationMinutes = routingResponse.total_duration_minutes;
    route.eta = eta;
    route.routeData = routingResponse;

    const updatedRoute = await this.routeRepository.save(route);

    this.logger.log(
      `Route ${routeId} stops reordered. New distance: ${updatedRoute.totalDistanceKm} km`,
    );

    // Broadcast route update via WebSocket
    this.dispatchGateway.emitRouteUpdated(updatedRoute);

    return updatedRoute;
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    const [byStatus, total] = await Promise.all([
      this.routeRepository
        .createQueryBuilder('route')
        .select('route.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('route.status')
        .getRawMany(),
      this.routeRepository.count(),
    ]);

    return {
      byStatus: byStatus.reduce(
        (acc, { status, count }) => ({ ...acc, [status]: parseInt(count) }),
        {},
      ),
      total,
    };
  }
}
