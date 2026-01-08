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
      if (job.pickupLocation?.coordinates) {
        coordinates.push(job.pickupLocation.coordinates);
      }
      // Add delivery location
      if (job.deliveryLocation?.coordinates) {
        coordinates.push(job.deliveryLocation.coordinates);
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
    this.logger.log(
      `Calling routing service for vehicle ${vehicleId} with ${jobIds.length} jobs`,
    );

    const request: RoutingServiceRequest = {
      vehicle_id: vehicleId,
      job_ids: jobIds,
    };

    try {
      const response: any = await firstValueFrom(
        this.httpService.post<RoutingServiceResponse>(
          `${this.routingServiceUrl}/route`,
          request,
        ) as any,
      );

      const data = response?.data as RoutingServiceResponse;

      if (!data.success) {
        throw new BadRequestException(
          `Routing optimization failed: ${data.error}`,
        );
      }

      return data;
    } catch (error) {
      this.logger.error(
        `Error calling routing service: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to optimize route: ${error.message}`,
      );
    }
  }

  /**
   * Create a new route with optimization
   */
  async create(createRouteDto: CreateRouteDto): Promise<Route> {
    this.logger.log(
      `Creating route for vehicle ${createRouteDto.vehicleId} with ${createRouteDto.jobIds.length} jobs`,
    );

    // Validate vehicle exists and is available
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: createRouteDto.vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException(
        `Vehicle ${createRouteDto.vehicleId} not found`,
      );
    }

    // Validate jobs exist and are pending
    const jobs = await this.jobRepository.findByIds(createRouteDto.jobIds);

    if (jobs.length !== createRouteDto.jobIds.length) {
      throw new BadRequestException('One or more jobs not found');
    }

    const nonPendingJobs = jobs.filter(
      (job) => job.status !== JobStatus.PENDING,
    );
    if (nonPendingJobs.length > 0) {
      throw new BadRequestException(
        `Jobs must be in 'pending' status. Found: ${nonPendingJobs.map((j) => j.status).join(', ')}`,
      );
    }

    // Call routing service for optimization
    const routingResponse = await this.callRoutingService(
      createRouteDto.vehicleId,
      createRouteDto.jobIds,
    );

    // Extract optimized job order from routing response
    const optimizedJobIds = routingResponse.route.map((r) => r.job_id);

    // Generate polyline geometry
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

    // Create route entity
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

    this.logger.log(`Route ${savedRoute.id} created successfully with color ${color}`);

    // Broadcast route creation via WebSocket
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
    const route = await this.findOne(id);

    if (route.status !== RouteStatus.PLANNED) {
      throw new BadRequestException(
        `Route must be in 'planned' status to start. Current: ${route.status}`,
      );
    }

    // Update route status
    route.status = RouteStatus.IN_PROGRESS;
    route.actualStart = new Date();

    // Update vehicle status to "in_route"
    await this.vehicleRepository.update(route.vehicleId, {
      status: 'in_route',
    });

    // Update job statuses to "assigned"
    await this.jobRepository.update(
      { id: route.jobIds as any },
      { status: JobStatus.ASSIGNED, assignedRouteId: route.id },
    );

    const updatedRoute = await this.routeRepository.save(route);

    this.logger.log(
      `Route ${route.id} started. Vehicle ${route.vehicleId} now in_route`,
    );

    // Broadcast route started via WebSocket
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
