import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Route, RouteStatus } from './entities/route.entity';
import { RouteWorkflowStatus } from './entities/route.entity';
import {
  RerouteAction,
  RerouteExceptionCategory,
  RerouteRequest,
} from './entities/reroute-request.entity';
import { DispatchEvent } from './entities/dispatch-event.entity';
import { RouteVersion, RouteVersionStatus } from './entities/route-version.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Job, JobStatus } from '../jobs/entities/job.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import {
  ApplyRerouteDto,
  RequestRerouteDto,
  ReviewRerouteDto,
} from './dto/reroute.dto';
import {
  RoutingServiceRequest,
  RoutingServiceResponse,
  GlobalRoutingServiceRequest,
  GlobalRoutingServiceResponse,
  RouteInfo,
  OptimizeRequest,
  OptimizeResponse,
  OptimizeRouteOutput,
  DataQuality,
  OptimizationStatus,
  OptimizerHealth,
  OptimizerEvent,
} from './dto/routing-service.dto';
import { DispatchGateway } from './dispatch.gateway';
import {
  deriveWorkflowRouteStatus,
  isRouteTransitionAllowed,
  normalizeIncomingRouteStatus,
  normalizePlanningMetadata,
} from './dispatch-workflow';
import { canTransitionRerouteRequest } from './reroute-workflow';
import {
  buildRerouteImpactSummary,
  preserveDegradedOrSimulatedQuality,
  isDispatchBlockedByRerouteState,
} from './reroute-impact';
import { validateRerouteActionPayload } from './reroute-action-validation';
import { assertSplitRouteConsistency, splitRouteJobIds } from './split-route';
import { validateRerouteOverride } from './reroute-override';
import { deriveDispatchEventIndexFields } from './dispatch-event-indexing';
import { normalizeTimelineFilters } from './timeline-query';
import {
  buildRerouteAlternatives,
  evaluateRerouteConstraints,
} from './reroute-constraints';
import { OptimizationJobLifecycleService } from './services/optimization-job-lifecycle.service';

export type DispatchActorContext = {
  userId?: string | null;
  email?: string | null;
  organizationId?: string | null;
  roles?: string[];
};

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);
  private readonly routingServiceUrl: string;
  private optimizerHealth: OptimizerHealth = {
    status: 'degraded',
    circuitOpen: false,
    consecutiveFailures: 0,
    lastCheckedAt: new Date(0).toISOString(),
    message: 'Optimizer has not been checked yet.',
  };
  private optimizerEvents: OptimizerEvent[] = [];

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
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(RerouteRequest)
    private readonly rerouteRequestRepository: Repository<RerouteRequest>,
    @InjectRepository(DispatchEvent)
    private readonly dispatchEventRepository: Repository<DispatchEvent>,
    @InjectRepository(RouteVersion)
    private readonly routeVersionRepository: Repository<RouteVersion>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => DispatchGateway))
    private readonly dispatchGateway: DispatchGateway,
    private readonly optimizationJobs: OptimizationJobLifecycleService,
  ) {
    this.routingServiceUrl =
      this.configService.get<string>('ROUTING_SERVICE_URL') ||
      this.configService.get<string>('ROUTING_PROVIDER_URL') ||
      'http://localhost:8000';
  }

  private async ensureOrganizationScope(
    organizationId: string | null | undefined,
    vehicles: Vehicle[],
    jobs: Job[],
  ) {
    if (!organizationId) {
      return;
    }

    const mismatchedVehicles = vehicles.filter(
      (vehicle) => vehicle.organizationId && vehicle.organizationId !== organizationId,
    );
    if (mismatchedVehicles.length > 0) {
      throw new BadRequestException('VEHICLES_OUTSIDE_ORGANIZATION_SCOPE');
    }

    const mismatchedJobs = jobs.filter(
      (job) => job.organizationId && job.organizationId !== organizationId,
    );
    if (mismatchedJobs.length > 0) {
      throw new BadRequestException('JOBS_OUTSIDE_ORGANIZATION_SCOPE');
    }

    const orphanVehicleIds = vehicles
      .filter((vehicle) => !vehicle.organizationId)
      .map((vehicle) => vehicle.id);
    if (orphanVehicleIds.length > 0) {
      await this.vehicleRepository
        .createQueryBuilder()
        .update()
        .set({ organizationId })
        .where('id IN (:...ids)', { ids: orphanVehicleIds })
        .execute();
      vehicles.forEach((vehicle) => {
        if (!vehicle.organizationId) {
          vehicle.organizationId = organizationId;
        }
      });
    }

    const orphanJobIds = jobs.filter((job) => !job.organizationId).map((job) => job.id);
    if (orphanJobIds.length > 0) {
      await this.jobRepository
        .createQueryBuilder()
        .update()
        .set({ organizationId })
        .where('id IN (:...ids)', { ids: orphanJobIds })
        .execute();
      jobs.forEach((job) => {
        if (!job.organizationId) {
          job.organizationId = organizationId;
        }
      });
    }
  }

  private ensureValidRouteTransition(current: RouteStatus, next: RouteStatus) {
    if (isRouteTransitionAllowed(current, next)) {
      return;
    }
    throw new BadRequestException(
      `Invalid route transition: ${current} -> ${next}`,
    );
  }

  private async pruneDispatchEventsIfNeeded() {
    const retentionDays = Number(
      this.configService.get<string>('DISPATCH_EVENT_RETENTION_DAYS', '30'),
    );
    if (Number.isNaN(retentionDays) || retentionDays <= 0) return;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    await this.dispatchEventRepository
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff: cutoff.toISOString() })
      .execute();
  }

  private async logDispatchEvent(event: {
    routeId?: string | null;
    source: 'optimizer' | 'reroute' | 'workflow' | 'system';
    level?: 'info' | 'warning' | 'error';
    code: string;
    message: string;
    aggregateType?: 'ROUTE' | 'JOB' | 'VEHICLE' | 'ROUTE_VERSION';
    aggregateId?: string | null;
    eventType?: string;
    actorUserId?: string | null;
    payload?: Record<string, any>;
    reasonCode?: string | null;
    action?: string | null;
    actor?: string | null;
    packId?: string | null;
  }) {
    try {
      const indexed = deriveDispatchEventIndexFields({
        reasonCode: event.reasonCode,
        action: event.action,
        actor: event.actor,
        packId: event.packId,
        payload: event.payload || null,
      });
      const entity = this.dispatchEventRepository.create({
        routeId: event.routeId || null,
        aggregateType: event.aggregateType || 'ROUTE',
        aggregateId: event.aggregateId || event.routeId || null,
        eventType: event.eventType || event.code,
        actorUserId: event.actorUserId || null,
        source: event.source,
        level: event.level || 'info',
        code: event.code,
        message: event.message,
        payload: event.payload || {},
        reasonCode: indexed.reasonCode,
        action: indexed.action,
        actor: indexed.actor || event.actor || event.actorUserId || 'system',
        packId: indexed.packId,
      });
      await this.dispatchEventRepository.save(entity);
      await this.pruneDispatchEventsIfNeeded();
    } catch (error) {
      this.logger.warn(`Failed to persist dispatch event (${event.code}): ${error?.message || error}`);
    }
  }

  private getActorLabel(actor?: DispatchActorContext | null) {
    if (!actor) return null;
    return actor.email || actor.userId || null;
  }

  private getActorUserId(actor?: DispatchActorContext | null) {
    return actor?.userId || null;
  }

  private buildRouteVersionSnapshot(route: Route): Record<string, unknown> {
    return {
      route: this.buildRouteSnapshot(route),
      driverId: route.driverId || null,
      vehicleId: route.vehicleId,
      polyline: route.polyline || null,
      routeData: route.routeData || {},
      notes: route.notes || null,
      plannedStart: route.plannedStart?.toISOString() || null,
    };
  }

  private buildRouteVersionMetadata(
    version: Pick<RouteVersion, 'id' | 'versionNumber' | 'status' | 'publishedAt'>,
    extras: Record<string, unknown> = {},
  ) {
    return {
      versionId: version.id,
      versionNumber: version.versionNumber,
      status: version.status,
      publishedAt: version.publishedAt?.toISOString() || null,
      ...extras,
    };
  }

  private async getNextRouteVersionNumber(routeId: string) {
    const latest = await this.routeVersionRepository.findOne({
      where: { routeId },
      order: { versionNumber: 'DESC' },
    });
    return (latest?.versionNumber || 0) + 1;
  }

  private async seedPublishedRouteVersion(
    route: Route,
    actor?: DispatchActorContext,
  ) {
    const existingVersion = await this.routeVersionRepository.findOne({
      where: { routeId: route.id },
      order: { versionNumber: 'DESC' },
    });

    if (existingVersion) {
      return existingVersion;
    }

    const version = this.routeVersionRepository.create({
      routeId: route.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      snapshot: this.buildRouteVersionSnapshot(route),
      createdByUserId: this.getActorUserId(actor),
      publishedByUserId: this.getActorUserId(actor),
      publishedAt: new Date(),
    });
    const saved = await this.routeVersionRepository.save(version);
    route.routeData = {
      ...(route.routeData || {}),
      route_version: this.buildRouteVersionMetadata(saved),
    };
    await this.routeRepository.save(route);
    return saved;
  }

  private async ensureRouteVersionBackfill(
    route: Route,
    actor?: DispatchActorContext,
  ): Promise<RouteVersion> {
    const existingVersion = await this.routeVersionRepository.findOne({
      where: { routeId: route.id },
      order: { versionNumber: 'DESC' },
    });

    if (existingVersion) {
      if (!route.routeData?.route_version) {
        route.routeData = {
          ...(route.routeData || {}),
          route_version: this.buildRouteVersionMetadata(existingVersion, {
            lastPublishedVersionId: existingVersion.id,
            lastPublishedVersionNumber: existingVersion.versionNumber,
          }),
        };
        await this.routeRepository.save(route);
      }
      return existingVersion;
    }

    const backfilled = await this.seedPublishedRouteVersion(route, actor);
    await this.logDispatchEvent({
      routeId: route.id,
      aggregateType: 'ROUTE_VERSION',
      aggregateId: backfilled.id,
      eventType: 'ROUTE_VERSION_BACKFILLED',
      source: 'system',
      code: 'ROUTE_VERSION_BACKFILLED',
      message: 'Published route version backfilled for existing route.',
      actor: this.getActorLabel(actor) || 'system',
      actorUserId: this.getActorUserId(actor),
      payload: {
        routeId: route.id,
        versionId: backfilled.id,
        versionNumber: backfilled.versionNumber,
      },
    });
    return backfilled;
  }

  private async ensurePlanningDraftVersion(
    route: Route,
    actor?: DispatchActorContext,
    mutationType?: string,
  ): Promise<RouteVersion> {
    const latestVersion = await this.ensureRouteVersionBackfill(route, actor);

    if (latestVersion.status !== 'PUBLISHED') {
      route.routeData = {
        ...(route.routeData || {}),
        route_version: this.buildRouteVersionMetadata(latestVersion),
      };
      return latestVersion;
    }

    const draftVersion = this.routeVersionRepository.create({
      routeId: route.id,
      versionNumber: await this.getNextRouteVersionNumber(route.id),
      status: 'DRAFT',
      snapshot: this.buildRouteVersionSnapshot(route),
      createdByUserId: this.getActorUserId(actor),
    });
    const savedDraft = await this.routeVersionRepository.save(draftVersion);
    route.routeData = {
      ...(route.routeData || {}),
      route_version: this.buildRouteVersionMetadata(savedDraft, {
        lastPublishedVersionId: latestVersion.id,
        lastPublishedVersionNumber: latestVersion.versionNumber,
        lastPublishedAt: latestVersion.publishedAt?.toISOString() || null,
        forkedFromVersionId: latestVersion.id,
      }),
    };
    await this.logDispatchEvent({
      routeId: route.id,
      aggregateType: 'ROUTE_VERSION',
      aggregateId: savedDraft.id,
      eventType: 'ROUTE_DRAFT_FORKED_FROM_PUBLISHED',
      source: 'workflow',
      code: 'ROUTE_DRAFT_FORKED_FROM_PUBLISHED',
      message: `Planning draft forked from published route before ${mutationType || 'mutation'}.`,
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
      payload: {
        routeId: route.id,
        mutationType: mutationType || 'unknown',
        draftVersionId: savedDraft.id,
        draftVersionNumber: savedDraft.versionNumber,
        publishedVersionId: latestVersion.id,
        publishedVersionNumber: latestVersion.versionNumber,
      },
    });
    return savedDraft;
  }

  private async markOptimizerSuccess() {
    const now = new Date().toISOString();
    this.optimizerHealth = {
      status: 'healthy',
      circuitOpen: false,
      consecutiveFailures: 0,
      lastCheckedAt: now,
      lastSuccessAt: now,
      lastFailureAt: this.optimizerHealth.lastFailureAt,
      message: 'Optimization service is responding normally.',
    };
    this.optimizerEvents.unshift({
      level: 'info',
      code: 'ROUTING_SERVICE_OK',
      message: 'Optimization service call succeeded.',
      fallbackUsed: false,
      timestamp: now,
    });
    this.optimizerEvents = this.optimizerEvents.slice(0, 200);
    await this.logDispatchEvent({
      source: 'optimizer',
      level: 'info',
      code: 'ROUTING_SERVICE_OK',
      message: 'Optimization service call succeeded.',
      payload: {
        circuitOpen: this.optimizerHealth.circuitOpen,
        consecutiveFailures: this.optimizerHealth.consecutiveFailures,
      },
    });
  }

  private async markOptimizerFailure(message: string) {
    const now = new Date().toISOString();
    const failures = this.optimizerHealth.consecutiveFailures + 1;
    this.optimizerHealth = {
      status: failures >= 3 ? 'unavailable' : 'degraded',
      circuitOpen: failures >= 5,
      consecutiveFailures: failures,
      lastCheckedAt: now,
      lastSuccessAt: this.optimizerHealth.lastSuccessAt,
      lastFailureAt: now,
      message,
    };
    this.optimizerEvents.unshift({
      level: 'error',
      code: 'ROUTING_SERVICE_FAILURE',
      message,
      fallbackUsed: true,
      timestamp: now,
    });
    this.optimizerEvents = this.optimizerEvents.slice(0, 200);
    await this.logDispatchEvent({
      source: 'optimizer',
      level: 'error',
      code: 'ROUTING_SERVICE_FAILURE',
      message,
      payload: {
        circuitOpen: this.optimizerHealth.circuitOpen,
        consecutiveFailures: this.optimizerHealth.consecutiveFailures,
      },
    });
  }

  getOptimizerHealth(): OptimizerHealth {
    return { ...this.optimizerHealth };
  }

  getOptimizationJobs(limit = 100) {
    return this.optimizationJobs.list(limit);
  }

  async getOptimizerEvents(limit = 50): Promise<OptimizerEvent[]> {
    const capped = Math.max(1, Math.min(200, limit));
    const persisted = await this.dispatchEventRepository.find({
      where: { source: 'optimizer' },
      order: { createdAt: 'DESC' },
      take: capped,
    });
    if (persisted.length > 0) {
      return persisted.map((event) => ({
        level: event.level as any,
        code: event.code,
        message: event.message,
        fallbackUsed: Boolean(event.payload?.fallbackUsed || event.level === 'error'),
        timestamp: event.createdAt.toISOString(),
      }));
    }
    return this.optimizerEvents.slice(0, capped);
  }

  async getDispatchTimeline(
    routeId?: string,
    limit = 100,
    filters: {
      reasonCode?: string;
      action?: string;
      actor?: string;
      source?: 'optimizer' | 'reroute' | 'workflow' | 'system';
      before?: string;
      packId?: string;
    } = {},
  ): Promise<DispatchEvent[]> {
    const capped = Math.max(1, Math.min(500, limit));
    const normalizedFilters = normalizeTimelineFilters(filters);
    const qb = this.dispatchEventRepository
      .createQueryBuilder('event')
      .orderBy('event.created_at', 'DESC')
      .take(capped);

    if (routeId) {
      qb.andWhere('event.route_id = :routeId', { routeId });
    }
    if (normalizedFilters.source) {
      qb.andWhere('event.source = :source', { source: normalizedFilters.source });
    }
    if (normalizedFilters.before) {
      qb.andWhere('event.created_at < :before', { before: normalizedFilters.before });
    }
    if (normalizedFilters.reasonCode) {
      qb.andWhere(
        '(event.reason_code = :reasonCodeExact OR CAST(event.payload AS text) ILIKE :reasonCodeLike)',
        {
          reasonCodeExact: normalizedFilters.reasonCode,
          reasonCodeLike: `%${normalizedFilters.reasonCode}%`,
        },
      );
    }
    if (normalizedFilters.action) {
      qb.andWhere('(event.action = :actionExact OR CAST(event.payload AS text) ILIKE :actionLike)', {
        actionExact: normalizedFilters.action,
        actionLike: `%${normalizedFilters.action}%`,
      });
    }
    if (normalizedFilters.actor) {
      qb.andWhere('(event.actor = :actorExact OR CAST(event.payload AS text) ILIKE :actorLike)', {
        actorExact: normalizedFilters.actor,
        actorLike: `%${normalizedFilters.actor}%`,
      });
    }
    if (normalizedFilters.packId) {
      qb.andWhere('(event.pack_id = :packIdExact OR CAST(event.payload AS text) ILIKE :packIdLike)', {
        packIdExact: normalizedFilters.packId,
        packIdLike: `%${normalizedFilters.packId}%`,
      });
    }

    return qb.getMany();
  }

  presentRoute(route: Route): Route & {
    dataQuality: DataQuality;
    optimizationStatus: OptimizationStatus;
    planningWarnings: string[];
    droppedJobIds: string[];
    plannerDiagnostics: Record<string, any>;
    workflowStatus: string;
    simulated: boolean;
    rerouteState?: string;
    pendingRerouteRequestId?: string | null;
    exceptionCategory?: string | null;
  } {
    const routeData = route.routeData || {};
    const planning = normalizePlanningMetadata(routeData);
    const workflowStatus = deriveWorkflowRouteStatus(
      route.status,
      planning.dataQuality,
      Boolean(routeData.rerouting),
    );
    return {
      ...(route as any),
      dataQuality: planning.dataQuality,
      optimizationStatus: planning.optimizationStatus,
      planningWarnings: planning.warnings,
      droppedJobIds: planning.droppedJobIds,
      plannerDiagnostics: planning.plannerDiagnostics,
      workflowStatus: (route.workflowStatus || workflowStatus) as any,
      simulated: planning.simulated,
      rerouteState: routeData.reroute_state || null,
      pendingRerouteRequestId: routeData.pending_reroute_request_id || null,
      exceptionCategory: routeData.exception_category || null,
    };
  }

  private normalizeRouteStatus(status: string | RouteStatus): RouteStatus {
    const normalized = normalizeIncomingRouteStatus(status);
    if (!Object.values(RouteStatus).includes(normalized)) {
      throw new BadRequestException(
        `Unsupported route status: ${status}`,
      );
    }
    return normalized;
  }

  private syncPersistedWorkflowStatus(route: Route) {
    const nextWorkflow = deriveWorkflowRouteStatus(
      route.status,
      this.getRouteDataQualityFromRouteData(route.routeData),
      Boolean(route.routeData?.rerouting),
    );
    route.workflowStatus = nextWorkflow as RouteWorkflowStatus;
  }

  private buildRouteSnapshot(route: Route) {
    return {
      routeId: route.id,
      status: route.status,
      workflowStatus: route.workflowStatus,
      jobIds: Array.isArray(route.jobIds) ? [...route.jobIds] : [],
      totalDistanceKm: route.totalDistanceKm ?? null,
      totalDurationMinutes: route.totalDurationMinutes ?? null,
      eta: route.eta || null,
      dataQuality: this.getRouteDataQualityFromRouteData(route.routeData),
      optimizationStatus: this.getOptimizationStatusFromRouteData(route.routeData),
      droppedJobIds: Array.isArray(route.routeData?.dropped_jobs)
        ? route.routeData.dropped_jobs
        : [],
    };
  }

  private getRouteDataQualityFromRouteData(
    routeData: any,
  ): DataQuality {
    const value = routeData?.data_quality;
    if (value === 'degraded' || value === 'simulated') return value;
    return 'live';
  }

  private getOptimizationStatusFromRouteData(
    routeData: any,
  ): OptimizationStatus {
    const value = routeData?.optimization_status;
    if (value === 'degraded' || value === 'failed') return value;
    return 'optimized';
  }

  private computeImpactSummary(beforeSnapshot: any, afterSnapshot: any) {
    return buildRerouteImpactSummary(beforeSnapshot, afterSnapshot);
  }

  private async loadJobsByIds(jobIds: string[]): Promise<Job[]> {
    if (!Array.isArray(jobIds) || jobIds.length === 0) return [];
    const uniqueIds = Array.from(new Set(jobIds));
    return this.jobRepository.findByIds(uniqueIds);
  }

  private async computeRerouteConstraintDiagnostics(params: {
    route: Route;
    action: RerouteAction;
    payload: Record<string, any>;
    beforeSnapshot: any;
    afterSnapshot: any;
  }) {
    const impactedIds = Array.from(
      new Set([
        ...(Array.isArray(params.beforeSnapshot?.jobIds) ? params.beforeSnapshot.jobIds : []),
        ...(Array.isArray(params.afterSnapshot?.jobIds) ? params.afterSnapshot.jobIds : []),
      ]),
    );
    const [jobs, vehicle, driver] = await Promise.all([
      this.loadJobsByIds(impactedIds),
      params.route.vehicleId
        ? this.vehicleRepository.findOne({ where: { id: params.route.vehicleId } })
        : Promise.resolve(null),
      params.route.driverId
        ? this.driverRepository.findOne({ where: { id: params.route.driverId } })
        : Promise.resolve(null),
    ]);
    const targetRoute =
      params.action === 'reassign_stop_to_route' && typeof params.payload?.targetRouteId === 'string'
        ? await this.routeRepository.findOne({ where: { id: params.payload.targetRouteId } })
        : null;

    return evaluateRerouteConstraints({
      route: params.route,
      action: params.action,
      payload: params.payload,
      beforeSnapshot: params.beforeSnapshot,
      afterSnapshot: params.afterSnapshot,
      jobs,
      vehicle,
      driver,
      targetRoute,
    });
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
   * Build a deterministic fallback route when the routing service is unavailable.
   */
  private buildFallbackRouteResponse(
    jobIds: string[],
    reason: string,
  ): RoutingServiceResponse {
    const now = Date.now();
    const fallbackRoute = jobIds.map((jobId, index) => ({
      job_id: jobId,
      sequence: index,
      location: {
        latitude: 0,
        longitude: 0,
      },
      estimated_arrival: new Date(now + (index + 1) * 20 * 60 * 1000).toISOString(),
      time_window_start: new Date(now).toISOString(),
      time_window_end: new Date(now + 8 * 60 * 60 * 1000).toISOString(),
      priority: 0,
    }));

    return {
      success: true,
      route: fallbackRoute,
      total_distance_km: Number((jobIds.length * 8).toFixed(2)),
      total_duration_minutes: jobIds.length * 20,
      num_jobs: jobIds.length,
      vehicle_start_location: {
        latitude: 0,
        longitude: 0,
      },
      polyline: null,
      error: reason,
      optimization_status: 'degraded',
      data_quality: 'simulated',
      is_fallback: true,
      fallback_reason: reason,
      warnings: ['Fallback planner output is simulated.'],
      dropped_jobs: [],
      planner_diagnostics: {},
    };
  }

  /**
   * Build fallback global routing (round-robin) when optimization service fails.
   */
  private buildFallbackGlobalRoutingResponse(
    vehicleIds: string[],
    jobIds: string[],
    reason: string,
  ): GlobalRoutingServiceResponse {
    if (vehicleIds.length === 0) {
      return {
        success: true,
        routes: {},
        unassigned_jobs: jobIds,
        error: reason,
        optimization_status: 'failed',
        data_quality: 'degraded',
        is_fallback: true,
        fallback_reason: reason,
        warnings: ['No vehicles available; all jobs are unassigned.'],
        planner_diagnostics: {},
      };
    }

    const now = Date.now();
    const routes: GlobalRoutingServiceResponse['routes'] = {};

    vehicleIds.forEach((vehicleId) => {
      routes[vehicleId] = {
        route: [],
        total_distance_km: 0,
        total_duration_minutes: 0,
        num_jobs: 0,
        vehicle_start_location: {
          latitude: 0,
          longitude: 0,
        },
        data_quality: 'simulated',
        optimization_status: 'degraded',
        warnings: ['Round-robin fallback assignment was used.'],
        dropped_jobs: [],
        planner_diagnostics: {},
      };
    });

    jobIds.forEach((jobId, index) => {
      const vehicleId = vehicleIds[index % vehicleIds.length];
      const currentRoute = routes[vehicleId];

      currentRoute.route.push({
        job_id: jobId,
        sequence: currentRoute.route.length,
        location: {
          latitude: 0,
          longitude: 0,
        },
        estimated_arrival: new Date(
          now + (currentRoute.route.length + 1) * 20 * 60 * 1000,
        ).toISOString(),
        time_window_start: new Date(now).toISOString(),
        time_window_end: new Date(now + 8 * 60 * 60 * 1000).toISOString(),
        priority: 0,
      });
    });

    Object.values(routes).forEach((route) => {
      route.num_jobs = route.route.length;
      route.total_distance_km = Number((route.num_jobs * 8).toFixed(2));
      route.total_duration_minutes = route.num_jobs * 20;
    });

    return {
      success: true,
      routes,
      unassigned_jobs: [],
      error: reason,
      optimization_status: 'degraded',
      data_quality: 'simulated',
      is_fallback: true,
      fallback_reason: reason,
      warnings: ['Fallback global planner output is simulated.'],
      planner_diagnostics: {},
    };
  }

  private getVehicleCoordinates(vehicle: Vehicle) {
    const lat = Number(vehicle.currentLocation?.lat);
    const lng = Number(vehicle.currentLocation?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException(
        `Vehicle ${vehicle.id} does not have valid current coordinates.`,
      );
    }
    return { lat, lng };
  }

  private getJobCoordinates(job: Job) {
    const lat = Number(job.deliveryLocation?.lat);
    const lng = Number(job.deliveryLocation?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException(
        `Job ${job.id} does not have valid delivery coordinates.`,
      );
    }
    return { lat, lng };
  }

  private mapJobPriority(priority?: string) {
    switch (String(priority || '').toLowerCase()) {
      case 'urgent':
        return 1;
      case 'high':
        return 2;
      case 'low':
        return 4;
      default:
        return 3;
    }
  }

  private buildOptimizeRequest(vehicles: Vehicle[], jobs: Job[]): OptimizeRequest {
    return {
      plan_date: new Date().toISOString(),
      vehicles: vehicles.map((vehicle) => {
        const start = this.getVehicleCoordinates(vehicle);
        return {
          id: vehicle.id,
          start_lat: start.lat,
          start_lng: start.lng,
          capacity_volume: Number(vehicle.capacityVolumeM3 || 0),
          max_route_minutes: Number(vehicle.metadata?.maxRouteMinutes || 480),
        };
      }),
      stops: jobs.map((job) => {
        const location = this.getJobCoordinates(job);
        return {
          id: job.id,
          lat: location.lat,
          lng: location.lng,
          service_minutes: Number(job.estimatedDuration || 10),
          tw_start: job.timeWindowStart?.toISOString(),
          tw_end: job.timeWindowEnd?.toISOString(),
          priority: this.mapJobPriority(job.priority),
          volume: Number(job.volume || 0),
          locked_vehicle_id:
            typeof job.assignedRouteId === 'string' && job.assignedRouteId.length > 0
              ? null
              : null,
        };
      }),
    };
  }

  private mapOptimizeRouteToLegacy(
    route: OptimizeRouteOutput,
    vehicle: Vehicle,
    jobsById: Map<string, Job>,
    warnings: string[],
    droppedJobIds: string[],
  ): RouteInfo {
    const start = this.getVehicleCoordinates(vehicle);
    return {
      route: route.ordered_stops.map((stop) => {
        const job = jobsById.get(stop.stop_id);
        const location = job ? this.getJobCoordinates(job) : { lat: 0, lng: 0 };
        return {
          job_id: stop.stop_id,
          sequence: stop.sequence,
          location: {
            latitude: location.lat,
            longitude: location.lng,
          },
          estimated_arrival:
            stop.eta || job?.timeWindowStart?.toISOString() || new Date().toISOString(),
          time_window_start:
            job?.timeWindowStart?.toISOString() || new Date().toISOString(),
          time_window_end:
            job?.timeWindowEnd?.toISOString() || new Date().toISOString(),
          priority: this.mapJobPriority(job?.priority),
        };
      }),
      total_distance_km: Number((route.total_distance_m / 1000).toFixed(2)),
      total_duration_minutes: Number((route.total_duration_s / 60).toFixed(2)),
      num_jobs: route.ordered_stops.length,
      vehicle_start_location: {
        latitude: start.lat,
        longitude: start.lng,
      },
      data_quality: 'live',
      optimization_status: 'optimized',
      warnings,
      dropped_jobs: droppedJobIds,
      planner_diagnostics: {},
    };
  }

  private async callOptimizerV2(
    request: OptimizeRequest,
  ): Promise<OptimizeResponse> {
    const requestUrl = `${this.routingServiceUrl}/optimize`;
    this.logger.log(
      `[ROUTING:REQUEST] Calling routing service v2 at ${requestUrl} for ${request.vehicles.length} vehicles and ${request.stops.length} stops`,
    );
    this.logger.debug(`[ROUTING:REQUEST] Payload: ${JSON.stringify(request)}`);

    const startTime = Date.now();
    const response: any = await firstValueFrom(
      this.httpService.post<OptimizeResponse>(requestUrl, request, {
        timeout: 60_000,
      }) as any,
    );

    const duration = Date.now() - startTime;
    const data = response?.data as OptimizeResponse;
    this.logger.log(
      `[ROUTING:RESPONSE] v2 received response in ${duration}ms with ${data?.routes?.length || 0} routes`,
    );

    if (!data || !Array.isArray(data.routes)) {
      throw new BadRequestException(
        'ROUTING_SERVICE_EMPTY_RESPONSE: Routing service returned an invalid optimize response',
      );
    }
    await this.markOptimizerSuccess();
    return data;
  }

  /**
   * Call the Python routing-service to optimize route
   */
  async callRoutingService(
    vehicleId: string,
    jobIds: string[],
  ): Promise<RoutingServiceResponse> {
    const requestUrl = `${this.routingServiceUrl}/optimize`;
    try {
      const vehicle = await this.vehicleRepository.findOne({
        where: { id: vehicleId },
      });
      if (!vehicle) {
        throw new NotFoundException(`Vehicle ${vehicleId} not found`);
      }
      const jobs = await this.jobRepository.findByIds(jobIds);
      if (jobs.length !== jobIds.length) {
        throw new BadRequestException('ROUTING_SERVICE_ERROR: Some jobs were not found');
      }

      const optimizeResponse = await this.callOptimizerV2(
        this.buildOptimizeRequest([vehicle], jobs),
      );
      const optimizedRoute = optimizeResponse.routes.find(
        (route) => route.vehicle_id === vehicleId,
      );

      if (!optimizedRoute || optimizedRoute.ordered_stops.length === 0) {
        throw new BadRequestException(
          'ROUTING_OPTIMIZATION_FAILED: No feasible route returned for the requested vehicle',
        );
      }

      const jobsById = new Map(jobs.map((job) => [job.id, job]));
      const mapped = this.mapOptimizeRouteToLegacy(
        optimizedRoute,
        vehicle,
        jobsById,
        optimizeResponse.warnings || [],
        optimizeResponse.unassigned_stop_ids || [],
      );

      return {
        success: true,
        route: mapped.route,
        total_distance_km: mapped.total_distance_km,
        total_duration_minutes: mapped.total_duration_minutes,
        num_jobs: mapped.num_jobs,
        vehicle_start_location: mapped.vehicle_start_location,
        optimization_status: 'optimized',
        data_quality: 'live',
        warnings: mapped.warnings,
        dropped_jobs: mapped.dropped_jobs,
        planner_diagnostics: mapped.planner_diagnostics,
      };
    } catch (error) {
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
      await this.markOptimizerFailure(`${errorCode}: ${errorMessage}`);
      this.logger.warn(
        `[ROUTING:FALLBACK] Using fallback sequential routing for ${jobIds.length} jobs due to ${errorCode}`,
      );
      return this.buildFallbackRouteResponse(jobIds, `${errorCode}: ${errorMessage}`);
    }
  }

  /**
   * Call the Python routing-service to optimize global multi-vehicle routes
   */
  async callGlobalRoutingService(
    vehicleIds: string[],
    jobIds: string[],
  ): Promise<GlobalRoutingServiceResponse> {
    const requestUrl = `${this.routingServiceUrl}/optimize`;
    try {
      const vehicles = await this.vehicleRepository.findByIds(vehicleIds);
      const jobs = await this.jobRepository.findByIds(jobIds);
      if (vehicles.length !== vehicleIds.length) {
        throw new BadRequestException('ROUTING_SERVICE_ERROR: Some vehicles were not found');
      }
      if (jobs.length !== jobIds.length) {
        throw new BadRequestException('ROUTING_SERVICE_ERROR: Some jobs were not found');
      }

      const optimizeResponse = await this.callOptimizerV2(
        this.buildOptimizeRequest(vehicles, jobs),
      );
      const jobsById = new Map(jobs.map((job) => [job.id, job]));
      const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
      const routes: Record<string, RouteInfo> = {};

      for (const route of optimizeResponse.routes) {
        const vehicle = vehiclesById.get(route.vehicle_id);
        if (!vehicle) continue;
        routes[route.vehicle_id] = this.mapOptimizeRouteToLegacy(
          route,
          vehicle,
          jobsById,
          optimizeResponse.warnings || [],
          optimizeResponse.unassigned_stop_ids || [],
        );
      }

      return {
        success: true,
        routes,
        unassigned_jobs: optimizeResponse.unassigned_stop_ids || [],
        optimization_status: 'optimized',
        data_quality: 'live',
        warnings: optimizeResponse.warnings || [],
        planner_diagnostics: {},
      };
    } catch (error) {
      let errorCode = 'ROUTING_SERVICE_ERROR';
      let errorMessage = error.message;

      if (error.code === 'ECONNREFUSED') {
        errorCode = 'ROUTING_SERVICE_UNAVAILABLE';
        errorMessage = `Routing service is not running at ${this.routingServiceUrl}`;
      } else if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        errorCode = 'ROUTING_SERVICE_TIMEOUT';
        errorMessage = `Routing service timed out after 60 seconds`;
      } else if (error.response?.status === 404) {
        errorCode = 'ROUTING_ENDPOINT_NOT_FOUND';
        errorMessage = `Routing endpoint ${requestUrl} not found`;
      } else if (error.response?.status >= 500) {
        errorCode = 'ROUTING_SERVICE_INTERNAL_ERROR';
        errorMessage = `Routing service internal error: ${error.response?.data?.message || error.message}`;
      }

      this.logger.error(`[ROUTING:ERROR] ${errorCode}: ${errorMessage}`, error.stack);
      await this.markOptimizerFailure(`${errorCode}: ${errorMessage}`);
      this.logger.warn(
        `[ROUTING:FALLBACK] Using fallback round-robin global routing for ${jobIds.length} jobs due to ${errorCode}`,
      );
      return this.buildFallbackGlobalRoutingResponse(
        vehicleIds,
        jobIds,
        `${errorCode}: ${errorMessage}`,
      );
    }
  }

  /**
   * Create global routes with optimization for multiple vehicles
   */
  async createGlobalRoutes(
    dto: { vehicleIds: string[]; jobIds: string[] },
    actor?: DispatchActorContext,
  ): Promise<{
    routes: Route[];
    optimizationStatus: OptimizationStatus;
    dataQuality: DataQuality;
    droppedJobIds: string[];
    warnings: string[];
    optimizerHealth: OptimizerHealth;
  }> {
    const startTime = Date.now();
    this.logger.log(`[ROUTE:CREATE_GLOBAL] Starting global route creation for ${dto.vehicleIds.length} vehicles and ${dto.jobIds.length} jobs`);

    // Step 1: Validate vehicles exist
    const vehicles = await this.vehicleRepository.findByIds(dto.vehicleIds);
    if (vehicles.length !== dto.vehicleIds.length) {
      throw new BadRequestException(`VEHICLES_NOT_FOUND: Some vehicles were not found.`);
    }

    // Step 2: Validate jobs exist and are pending
    const jobs = await this.jobRepository.findByIds(dto.jobIds);
    if (jobs.length !== dto.jobIds.length) {
      throw new BadRequestException(`JOBS_NOT_FOUND: Some jobs were not found.`);
    }

    const nonPendingJobs = jobs.filter(
      (job) => ![JobStatus.PENDING, JobStatus.UNSCHEDULED].includes(job.status),
    );
    if (nonPendingJobs.length > 0) {
      throw new BadRequestException(`JOBS_INVALID_STATUS: Some jobs are not in 'pending' status.`);
    }

    // Step 3: Call global routing service
    const organizationId =
      actor?.organizationId ||
      vehicles[0]?.organizationId ||
      jobs[0]?.organizationId ||
      null;
    await this.ensureOrganizationScope(organizationId, vehicles, jobs);

    const optimizationJob = this.optimizationJobs.create({
      kind: 'global-route',
      organizationId: organizationId || undefined,
      vehicleIds: dto.vehicleIds,
      jobIds: dto.jobIds,
    });
    this.optimizationJobs.update(optimizationJob.id, 'running');

    let routingResponse: GlobalRoutingServiceResponse;
    try {
      routingResponse = await this.callGlobalRoutingService(dto.vehicleIds, dto.jobIds);
    } catch (error: any) {
      this.optimizationJobs.update(optimizationJob.id, 'failed', {
        error: error?.message || 'global optimization failed',
      });
      throw error;
    }

    const savedRoutes: Route[] = [];

    // Step 4: Create individual route entities
    for (const [vehicleId, routeInfo] of Object.entries(routingResponse.routes)) {
      if (routeInfo.route.length === 0) continue; // Skip vehicles that weren't assigned any jobs

      const optimizedJobIds = routeInfo.route.map((r) => r.job_id);
      const polyline = await this.generatePolyline(optimizedJobIds, { polyline: null } as any);
      const color = this.getNextRouteColor();

      const routeEntity = this.routeRepository.create({
        organizationId: organizationId || undefined,
        vehicleId,
        driverId: null, // assigned later
        jobIds: optimizedJobIds,
        routeData: {
          success: true,
          route: routeInfo.route,
          total_distance_km: routeInfo.total_distance_km,
          total_duration_minutes: routeInfo.total_duration_minutes,
          num_jobs: routeInfo.num_jobs,
          vehicle_start_location: routeInfo.vehicle_start_location,
          data_quality: routeInfo.data_quality || routingResponse.data_quality || 'live',
          optimization_status:
            routeInfo.optimization_status || routingResponse.optimization_status || 'optimized',
          warnings: routeInfo.warnings || routingResponse.warnings || [],
          dropped_jobs: routeInfo.dropped_jobs || [],
          planner_diagnostics: routeInfo.planner_diagnostics || routingResponse.planner_diagnostics || {},
          is_fallback: routingResponse.is_fallback || false,
          fallback_reason: routingResponse.fallback_reason || null,
          optimization_job_id: optimizationJob.id,
          optimization_job_status: 'completed',
        },
        status: RouteStatus.PLANNED,
        totalDistanceKm: routeInfo.total_distance_km,
        totalDurationMinutes: routeInfo.total_duration_minutes,
        jobCount: routeInfo.num_jobs,
        polyline,
        color,
        eta: null,
      });
      this.syncPersistedWorkflowStatus(routeEntity as Route);

      const savedRoute = await this.routeRepository.save(routeEntity);
      await this.seedPublishedRouteVersion(savedRoute, actor);
      savedRoutes.push(savedRoute);

      await this.jobRepository
        .createQueryBuilder()
        .update()
        .set({ status: JobStatus.ASSIGNED, assignedRouteId: savedRoute.id })
        .where('id IN (:...ids)', { ids: optimizedJobIds })
        .execute();

      this.dispatchGateway.emitRouteCreated(savedRoute);
      await this.logDispatchEvent({
        routeId: savedRoute.id,
        source: 'workflow',
        code: 'ROUTE_CREATED',
        message: 'Route created from global optimization result.',
        eventType: 'ROUTE_CREATED',
        actor: this.getActorLabel(actor),
        actorUserId: this.getActorUserId(actor),
        payload: {
          vehicleId,
          jobCount: optimizedJobIds.length,
          status: savedRoute.status,
        },
      });
    }

    const duration = Date.now() - startTime;
    this.logger.log(`[ROUTE:CREATE_GLOBAL] Created ${savedRoutes.length} routes in ${duration}ms`);

    this.optimizationJobs.update(optimizationJob.id, 'completed', {
      fallbackUsed: Boolean(routingResponse.is_fallback),
      warnings: routingResponse.warnings || [],
      resultRouteIds: savedRoutes.map((route) => route.id),
      metrics: {
        routeCount: savedRoutes.length,
        droppedJobCount: routingResponse.unassigned_jobs?.length || 0,
        optimizationStatus: routingResponse.optimization_status || 'optimized',
        dataQuality: routingResponse.data_quality || 'live',
      },
    });

    return {
      routes: savedRoutes,
      optimizationStatus: routingResponse.optimization_status || 'optimized',
      dataQuality: routingResponse.data_quality || 'live',
      droppedJobIds: routingResponse.unassigned_jobs || [],
      warnings: routingResponse.warnings || [],
      optimizerHealth: this.getOptimizerHealth(),
    };
  }

  /**
   * Create a new route with optimization
   */
  async create(
    createRouteDto: CreateRouteDto,
    actor?: DispatchActorContext,
  ): Promise<Route> {
    const optimizationJob = this.optimizationJobs.create({
      kind: 'single-route',
      organizationId: actor?.organizationId || undefined,
      vehicleIds: [createRouteDto.vehicleId],
      jobIds: createRouteDto.jobIds,
    });
    this.optimizationJobs.update(optimizationJob.id, 'running');
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
      (job) => ![JobStatus.PENDING, JobStatus.UNSCHEDULED].includes(job.status),
    );
    if (nonPendingJobs.length > 0) {
      throw new BadRequestException(
        `JOBS_INVALID_STATUS: ${nonPendingJobs.length} job(s) not in 'pending' status: [${nonPendingJobs.map((j) => `${j.id.substring(0, 8)}:${j.status}`).join(', ')}]`,
      );
    }
    this.logger.log(`[ROUTE:CREATE:STEP2] All ${jobs.length} jobs validated successfully`);
    const organizationId =
      actor?.organizationId ||
      vehicle.organizationId ||
      jobs[0]?.organizationId ||
      null;
    await this.ensureOrganizationScope(organizationId, [vehicle], jobs);

    // Step 3: Call routing service for optimization
    this.logger.log(`[ROUTE:CREATE:STEP3] Calling routing service for route optimization...`);
    let routingResponse: RoutingServiceResponse;
    try {
      routingResponse = await this.callRoutingService(
        createRouteDto.vehicleId,
        createRouteDto.jobIds,
      );
    } catch (error: any) {
      this.optimizationJobs.update(optimizationJob.id, 'failed', {
        error: error?.message || 'optimization failed',
      });
      throw error;
    }

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
      organizationId: organizationId || undefined,
      vehicleId: createRouteDto.vehicleId,
      driverId: createRouteDto.driverId,
      jobIds: optimizedJobIds,
      routeData: {
        ...routingResponse,
        data_quality: routingResponse.data_quality || 'live',
        optimization_status: routingResponse.optimization_status || 'optimized',
        warnings: routingResponse.warnings || [],
        dropped_jobs: routingResponse.dropped_jobs || [],
        planner_diagnostics: routingResponse.planner_diagnostics || {},
        is_fallback: routingResponse.is_fallback || false,
        fallback_reason: routingResponse.fallback_reason || null,
        optimization_job_id: optimizationJob.id,
        optimization_job_status: 'completed',
      },
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
    this.syncPersistedWorkflowStatus(route as Route);

    const savedRoute = await this.routeRepository.save(route);
    await this.seedPublishedRouteVersion(savedRoute, actor);

    const duration = Date.now() - startTime;
    this.logger.log(
      `[ROUTE:CREATE:COMPLETE] Route ${savedRoute.id.substring(0, 8)} created in ${duration}ms (color: ${color}, distance: ${routingResponse.total_distance_km}km, stops: ${routingResponse.num_jobs})`,
    );

    // Step 7: Link jobs to route
    this.logger.log(
      `[ROUTE:CREATE:STEP7] Linking ${savedRoute.jobIds.length} jobs to route ${savedRoute.id.substring(0, 8)}...`,
    );
    await this.jobRepository
      .createQueryBuilder()
      .update()
      .set({ status: JobStatus.ASSIGNED, assignedRouteId: savedRoute.id })
      .where('id IN (:...ids)', { ids: savedRoute.jobIds })
      .execute();

    // Step 8: Broadcast via WebSocket
    this.logger.log(`[ROUTE:CREATE:STEP8] Broadcasting route creation via WebSocket...`);
    this.dispatchGateway.emitRouteCreated(savedRoute);
    await this.logDispatchEvent({
      routeId: savedRoute.id,
      source: 'workflow',
      code: 'ROUTE_CREATED',
      message: 'Route created from dispatch planning request.',
      eventType: 'ROUTE_CREATED',
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
      payload: {
        vehicleId: savedRoute.vehicleId,
        jobCount: savedRoute.jobIds.length,
        status: savedRoute.status,
      },
    });

    this.optimizationJobs.update(optimizationJob.id, 'completed', {
      routeId: savedRoute.id,
      fallbackUsed: Boolean(routingResponse.is_fallback),
      warnings: routingResponse.warnings || [],
      resultRouteIds: [savedRoute.id],
      metrics: {
        droppedJobCount: routingResponse.dropped_jobs?.length || 0,
        optimizationStatus: routingResponse.optimization_status || 'optimized',
        dataQuality: routingResponse.data_quality || 'live',
        totalDistanceKm: routingResponse.total_distance_km,
        totalDurationMinutes: routingResponse.total_duration_minutes,
      },
    });
    return savedRoute;
  }

  /**
   * Find all routes
   */
  async findAll(status?: RouteStatus, actor?: DispatchActorContext): Promise<Route[]> {
    if (status) {
      return this.routeRepository.find({
        where: { status, ...(actor?.organizationId ? { organizationId: actor.organizationId } : {}) } as any,
        relations: ['vehicle'],
        order: { createdAt: 'DESC' },
      });
    }

    return this.routeRepository.find({
      where: actor?.organizationId ? ({ organizationId: actor.organizationId } as any) : undefined,
      relations: ['vehicle'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find one route by ID
   */
  async findOne(id: string, actor?: DispatchActorContext): Promise<Route> {
    const route = await this.routeRepository.findOne({
      where: { id, ...(actor?.organizationId ? { organizationId: actor.organizationId } : {}) } as any,
      relations: ['vehicle'],
    });

    if (!route) {
      throw new NotFoundException(`Route ${id} not found`);
    }

    return route;
  }

  async listRouteVersions(routeId: string, actor?: DispatchActorContext): Promise<RouteVersion[]> {
    const route = await this.findOne(routeId, actor);
    await this.ensureRouteVersionBackfill(route);
    return this.routeVersionRepository.find({
      where: { routeId, ...(actor?.organizationId ? { organizationId: actor.organizationId } : {}) } as any,
      order: { versionNumber: 'DESC' },
    });
  }

  async createRouteVersionSnapshot(
    routeId: string,
    actor?: DispatchActorContext,
  ): Promise<RouteVersion> {
    const route = await this.findOne(routeId, actor);
    await this.ensureRouteVersionBackfill(route, actor);
    const version = this.routeVersionRepository.create({
      routeId,
      versionNumber: await this.getNextRouteVersionNumber(routeId),
      status: 'DRAFT',
      snapshot: this.buildRouteVersionSnapshot(route),
      createdByUserId: this.getActorUserId(actor),
    });
    const saved = await this.routeVersionRepository.save(version);
    await this.logDispatchEvent({
      routeId,
      aggregateType: 'ROUTE_VERSION',
      aggregateId: saved.id,
      eventType: 'ROUTE_VERSION_CREATED',
      source: 'workflow',
      code: 'ROUTE_VERSION_CREATED',
      message: 'Route version snapshot created.',
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
      payload: {
        versionId: saved.id,
        versionNumber: saved.versionNumber,
        routeSnapshot: this.buildRouteSnapshot(route),
      },
    });
    return saved;
  }

  async reviewRouteVersion(
    routeId: string,
    versionId: string,
    actor?: DispatchActorContext,
  ): Promise<RouteVersion> {
    await this.findOne(routeId, actor);
    const version = await this.routeVersionRepository.findOne({
      where: { id: versionId, routeId },
    });

    if (!version) {
      throw new NotFoundException(`Route version ${versionId} not found`);
    }
    if (version.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT versions can be reviewed. Current: ${version.status}`,
      );
    }

    version.status = 'REVIEWED';
    version.reviewedByUserId = this.getActorUserId(actor);
    version.reviewedAt = new Date();
    const saved = await this.routeVersionRepository.save(version);
    await this.logDispatchEvent({
      routeId,
      aggregateType: 'ROUTE_VERSION',
      aggregateId: saved.id,
      eventType: 'ROUTE_VERSION_REVIEWED',
      source: 'workflow',
      code: 'ROUTE_VERSION_REVIEWED',
      message: 'Route version moved to review state.',
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
      payload: {
        versionId: saved.id,
        versionNumber: saved.versionNumber,
      },
    });
    return saved;
  }

  async approveRouteVersion(
    routeId: string,
    versionId: string,
    actor?: DispatchActorContext,
  ): Promise<RouteVersion> {
    await this.findOne(routeId, actor);
    const version = await this.routeVersionRepository.findOne({
      where: { id: versionId, routeId },
    });

    if (!version) {
      throw new NotFoundException(`Route version ${versionId} not found`);
    }
    if (!['DRAFT', 'REVIEWED'].includes(version.status)) {
      throw new BadRequestException(
        `Only DRAFT or REVIEWED versions can be approved. Current: ${version.status}`,
      );
    }

    version.status = 'APPROVED';
    version.approvedByUserId = this.getActorUserId(actor);
    version.approvedAt = new Date();
    const saved = await this.routeVersionRepository.save(version);
    await this.logDispatchEvent({
      routeId,
      aggregateType: 'ROUTE_VERSION',
      aggregateId: saved.id,
      eventType: 'ROUTE_VERSION_APPROVED',
      source: 'workflow',
      code: 'ROUTE_VERSION_APPROVED',
      message: 'Route version approved for publish.',
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
      payload: {
        versionId: saved.id,
        versionNumber: saved.versionNumber,
      },
    });
    return saved;
  }

  async publishRouteVersion(
    routeId: string,
    versionId: string,
    actor?: DispatchActorContext,
  ): Promise<RouteVersion> {
    const route = await this.findOne(routeId, actor);
    if ([RouteStatus.IN_PROGRESS, RouteStatus.COMPLETED, RouteStatus.CANCELLED].includes(route.status)) {
      throw new BadRequestException(
        `Route ${routeId} cannot publish versions while in status ${route.status}`,
      );
    }

    const version = await this.routeVersionRepository.findOne({
      where: { id: versionId, routeId },
    });
    if (!version) {
      throw new NotFoundException(`Route version ${versionId} not found`);
    }
    if (version.status !== 'APPROVED') {
      throw new BadRequestException(
        `Only APPROVED versions can be published. Current: ${version.status}`,
      );
    }

    await this.routeVersionRepository.update(
      { routeId, status: 'PUBLISHED' },
      { status: 'SUPERSEDED' },
    );

    version.status = 'PUBLISHED';
    version.publishedByUserId = this.getActorUserId(actor);
    version.publishedAt = new Date();

    const snapshotRoute = (version.snapshot?.route || {}) as Record<string, unknown>;
    route.jobIds = Array.isArray(snapshotRoute.jobIds)
      ? (snapshotRoute.jobIds as string[])
      : route.jobIds;
    route.driverId =
      typeof version.snapshot?.driverId === 'string'
        ? String(version.snapshot.driverId)
        : route.driverId;
    route.polyline = (version.snapshot?.polyline as any) || route.polyline;
    route.routeData = {
      ...((version.snapshot?.routeData as Record<string, unknown>) || route.routeData || {}),
      route_version: this.buildRouteVersionMetadata(version, {
        lastPublishedVersionId: version.id,
        lastPublishedVersionNumber: version.versionNumber,
      }),
    };
    route.totalDistanceKm =
      typeof snapshotRoute.totalDistanceKm === 'number'
        ? Number(snapshotRoute.totalDistanceKm)
        : route.totalDistanceKm;
    route.totalDurationMinutes =
      typeof snapshotRoute.totalDurationMinutes === 'number'
        ? Number(snapshotRoute.totalDurationMinutes)
        : route.totalDurationMinutes;
    route.jobCount = Array.isArray(route.jobIds) ? route.jobIds.length : route.jobCount;
    this.syncPersistedWorkflowStatus(route);
    await this.routeRepository.save(route);

    const saved = await this.routeVersionRepository.save(version);

    await this.logDispatchEvent({
      routeId,
      aggregateType: 'ROUTE_VERSION',
      aggregateId: saved.id,
      eventType: 'ROUTE_VERSION_PUBLISHED',
      source: 'workflow',
      code: 'ROUTE_VERSION_PUBLISHED',
      message: 'Route version published as the active plan.',
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
      payload: {
        versionId: saved.id,
        versionNumber: saved.versionNumber,
      },
    });
    this.dispatchGateway.emitRouteUpdated(route);
    return saved;
  }

  /**
   * Update a route
   */
  async update(
    id: string,
    updateRouteDto: UpdateRouteDto,
    actor?: DispatchActorContext,
  ): Promise<Route> {
    const route = await this.findOne(id, actor);
    const beforeSnapshot = this.buildRouteSnapshot(route);

    if (updateRouteDto.status) {
      const normalizedNextStatus = this.normalizeRouteStatus(updateRouteDto.status);
      updateRouteDto.status = normalizedNextStatus as any;
    }

    if (updateRouteDto.status && updateRouteDto.status !== route.status) {
      this.ensureValidRouteTransition(route.status, updateRouteDto.status as RouteStatus);

      if (updateRouteDto.status === RouteStatus.IN_PROGRESS) {
        return this.startRoute(id, actor);
      }
      if (updateRouteDto.status === RouteStatus.COMPLETED) {
        return this.completeRoute(id, actor);
      }
      if (updateRouteDto.status === RouteStatus.CANCELLED) {
        return this.cancelRoute(id, actor);
      }
    }

    await this.ensurePlanningDraftVersion(route, actor, 'route_update');
    Object.assign(route, updateRouteDto);
    this.syncPersistedWorkflowStatus(route);

    const updatedRoute = await this.routeRepository.save(route);
    await this.logDispatchEvent({
      routeId: updatedRoute.id,
      source: 'workflow',
      code: 'ROUTE_UPDATED',
      message: 'Route details updated.',
      eventType: 'ROUTE_UPDATED',
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
      payload: {
        before: beforeSnapshot,
        after: this.buildRouteSnapshot(updatedRoute),
      },
    });
    return updatedRoute;
  }

  /**
   * Assign a driver to a route and update related statuses
   */
  async assignDriver(
    routeId: string,
    driverId: string,
    actor?: DispatchActorContext,
  ): Promise<Route> {
    const route = await this.findOne(routeId, actor);

    if ([RouteStatus.COMPLETED, RouteStatus.CANCELLED].includes(route.status)) {
      throw new BadRequestException(
        `Cannot assign driver to ${route.status} route`,
      );
    }

    const driver = await this.driverRepository.findOne({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException(`Driver ${driverId} not found`);
    }

    await this.ensurePlanningDraftVersion(route, actor, 'assign_driver');
    route.driverId = driverId;
    if (route.status === RouteStatus.PLANNED) {
      route.status = RouteStatus.ASSIGNED;
    }
    this.syncPersistedWorkflowStatus(route);

    await this.driverRepository.update(driverId, {
      status: 'on_route',
      currentVehicleId: route.vehicleId,
    });

    await this.vehicleRepository.update(route.vehicleId, {
      status: 'in_route',
    });

    await this.jobRepository
      .createQueryBuilder()
      .update()
      .set({ status: JobStatus.ASSIGNED, assignedRouteId: route.id })
      .where('id IN (:...ids)', { ids: route.jobIds })
      .execute();

    const updatedRoute = await this.routeRepository.save(route);
    this.dispatchGateway.emitRouteUpdated(updatedRoute);
    await this.logDispatchEvent({
      routeId: updatedRoute.id,
      source: 'workflow',
      code: 'ROUTE_DRIVER_ASSIGNED',
      message: 'Driver assigned to route.',
      eventType: 'ROUTE_DRIVER_ASSIGNED',
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
      payload: {
        driverId,
        vehicleId: updatedRoute.vehicleId,
        status: updatedRoute.status,
      },
    });
    return updatedRoute;
  }

  /**
   * Start a route (assign to vehicle/driver)
   */
  async startRoute(id: string, actor?: DispatchActorContext): Promise<Route> {
    this.logger.log(`[ROUTE:START] Initiating route start for ${id.substring(0, 8)}...`);

    const route = await this.findOne(id, actor);
    if (isDispatchBlockedByRerouteState(route.routeData?.reroute_state || null)) {
      throw new BadRequestException(
        `Route ${id} has pending reroute state '${route.routeData?.reroute_state}' and cannot be dispatched`,
      );
    }

    if (![RouteStatus.PLANNED, RouteStatus.ASSIGNED].includes(route.status)) {
      throw new BadRequestException(
        `ROUTE_INVALID_STATUS: Cannot start route ${id.substring(0, 8)} - must be in 'planned' or 'assigned' status but is '${route.status}'`,
      );
    }

    // Step 1: Update route status
    this.logger.log(`[ROUTE:START:STEP1] Updating route status to IN_PROGRESS...`);
    route.status = RouteStatus.IN_PROGRESS;
    route.actualStart = new Date();
    this.syncPersistedWorkflowStatus(route);

    // Step 2: Update vehicle status to "in_route"
    this.logger.log(`[ROUTE:START:STEP2] Updating vehicle ${route.vehicleId.substring(0, 8)} status to "in_route"...`);
    await this.vehicleRepository.update(route.vehicleId, {
      status: 'in_route',
    });

    // Step 3: Update job statuses to "in_progress"
    this.logger.log(`[ROUTE:START:STEP3] Updating ${route.jobIds.length} jobs to "in_progress" status...`);
    const updateResult = await this.jobRepository
      .createQueryBuilder()
      .update()
      .set({ status: JobStatus.IN_PROGRESS, assignedRouteId: route.id })
      .where('id IN (:...ids)', { ids: route.jobIds })
      .execute();
    this.logger.log(`[ROUTE:START:STEP3] Updated ${updateResult.affected} jobs`);

    // Step 4: Save route
    this.logger.log(`[ROUTE:START:STEP4] Saving route changes...`);
    const updatedRoute = await this.routeRepository.save(route);

    this.logger.log(
      `[ROUTE:START:COMPLETE] Route ${route.id.substring(0, 8)} started successfully. Vehicle ${route.vehicleId.substring(0, 8)} now in_route with ${route.jobIds.length} assigned jobs`,
    );
    await this.logDispatchEvent({
      routeId: route.id,
      source: 'workflow',
      level: 'info',
      code: 'ROUTE_STARTED',
      eventType: 'ROUTE_STARTED',
      message: `Route ${route.id} started`,
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
      payload: { status: updatedRoute.status, workflowStatus: updatedRoute.workflowStatus },
    });

    // Step 5: Broadcast via WebSocket
    this.logger.log(`[ROUTE:START:STEP5] Broadcasting route started event...`);
    this.dispatchGateway.emitRouteStarted(updatedRoute);

    return updatedRoute;
  }

  /**
   * Complete a route
   */
  async completeRoute(id: string, actor?: DispatchActorContext): Promise<Route> {
    const route = await this.findOne(id, actor);

    if (route.status !== RouteStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Route must be 'in_progress' to complete. Current: ${route.status}`,
      );
    }

    route.status = RouteStatus.COMPLETED;
    route.completedAt = new Date();
    this.syncPersistedWorkflowStatus(route);

    // Update vehicle status back to "available"
    await this.vehicleRepository.update(route.vehicleId, {
      status: 'available',
    });

    // Mark route jobs completed
    await this.jobRepository
      .createQueryBuilder()
      .update()
      .set({
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
      })
      .where('id IN (:...ids)', { ids: route.jobIds })
      .execute();

    const completedRoute = await this.routeRepository.save(route);

    // Broadcast route completion via WebSocket
    this.dispatchGateway.emitRouteCompleted(completedRoute);
    await this.logDispatchEvent({
      routeId: route.id,
      source: 'workflow',
      level: 'info',
      code: 'ROUTE_COMPLETED',
      eventType: 'ROUTE_COMPLETED',
      message: `Route ${route.id} completed`,
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
      payload: { status: completedRoute.status, workflowStatus: completedRoute.workflowStatus },
    });

    return completedRoute;
  }

  /**
   * Cancel a route
   */
  async cancelRoute(id: string, actor?: DispatchActorContext): Promise<Route> {
    const route = await this.findOne(id, actor);
    this.ensureValidRouteTransition(route.status, RouteStatus.CANCELLED);

    const wasInProgress = route.status === RouteStatus.IN_PROGRESS;
    route.status = RouteStatus.CANCELLED;
    this.syncPersistedWorkflowStatus(route);

    // Reset vehicle status if in route
    if (wasInProgress) {
      await this.vehicleRepository.update(route.vehicleId, {
        status: 'available',
      });
    }

    // Reset job statuses back to pending
    await this.jobRepository
      .createQueryBuilder()
      .update()
      .set({ status: JobStatus.PENDING, assignedRouteId: null })
      .where('id IN (:...ids)', { ids: route.jobIds })
      .execute();

    const cancelledRoute = await this.routeRepository.save(route);
    this.dispatchGateway.emitRouteCancelled(cancelledRoute);
    await this.logDispatchEvent({
      routeId: route.id,
      source: 'workflow',
      level: 'warning',
      code: 'ROUTE_CANCELLED',
      eventType: 'ROUTE_CANCELLED',
      message: `Route ${route.id} cancelled`,
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
      payload: { status: cancelledRoute.status, workflowStatus: cancelledRoute.workflowStatus },
    });
    return cancelledRoute;
  }

  /**
   * Get routes by vehicle
   */
  async findByVehicle(vehicleId: string, actor?: DispatchActorContext): Promise<Route[]> {
    return this.routeRepository.find({
      where: { vehicleId, ...(actor?.organizationId ? { organizationId: actor.organizationId } : {}) } as any,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Reorder stops in a route and recalculate polyline
   */
  async reorderStops(
    routeId: string,
    newJobOrder: string[],
    actor?: DispatchActorContext,
  ): Promise<Route> {
    this.logger.log(
      `Reordering stops for route ${routeId} with ${newJobOrder.length} jobs`,
    );

    const route = await this.findOne(routeId, actor);
    const beforeSnapshot = this.buildRouteSnapshot(route);

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

    await this.ensurePlanningDraftVersion(route, actor, 'reorder_stops');
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
    route.routeData = {
      ...routingResponse,
      data_quality: routingResponse.data_quality || 'live',
      optimization_status: routingResponse.optimization_status || 'optimized',
      warnings: routingResponse.warnings || [],
      dropped_jobs: routingResponse.dropped_jobs || [],
      is_fallback: routingResponse.is_fallback || false,
      fallback_reason: routingResponse.fallback_reason || null,
    };
    this.syncPersistedWorkflowStatus(route);

    const updatedRoute = await this.routeRepository.save(route);

    this.logger.log(
      `Route ${routeId} stops reordered. New distance: ${updatedRoute.totalDistanceKm} km`,
    );

    // Broadcast route update via WebSocket
    this.dispatchGateway.emitRouteUpdated(updatedRoute);
    await this.logDispatchEvent({
      routeId: updatedRoute.id,
      source: 'workflow',
      code: 'ROUTE_REORDERED',
      message: 'Route stop order updated.',
      eventType: 'ROUTE_REORDERED',
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
      payload: {
        before: beforeSnapshot,
        after: this.buildRouteSnapshot(updatedRoute),
      },
    });

    return updatedRoute;
  }

  private async findRerouteRequest(routeId: string, requestId: string): Promise<RerouteRequest> {
    const request = await this.rerouteRequestRepository.findOne({
      where: { id: requestId, routeId },
    });
    if (!request) {
      throw new NotFoundException(`Reroute request ${requestId} not found for route ${routeId}`);
    }
    return request;
  }

  private buildAfterSnapshotFromSimulation(
    beforeSnapshot: any,
    action: RerouteAction,
    payload: Record<string, any>,
  ) {
    const beforeJobIds: string[] = Array.isArray(beforeSnapshot?.jobIds)
      ? [...beforeSnapshot.jobIds]
      : [];
    let jobIds = [...beforeJobIds];

    if (action === 'reorder_stops' && Array.isArray(payload.newJobOrder)) {
      jobIds = [...payload.newJobOrder];
    } else if ((action === 'remove_stop' || action === 'reassign_stop_to_route') && payload.jobId) {
      jobIds = jobIds.filter((id) => id !== payload.jobId);
    } else if (action === 'hold_stop' && payload.jobId) {
      jobIds = [...jobIds.filter((id) => id !== payload.jobId), payload.jobId];
    } else if (action === 'split_route' && typeof payload.splitAtIndex === 'number') {
      jobIds = jobIds.slice(0, payload.splitAtIndex);
    }

    const deltaFactor = Math.max(0.15, jobIds.length / Math.max(1, beforeJobIds.length));
    const totalDistanceKm = Number(((beforeSnapshot.totalDistanceKm || 0) * deltaFactor).toFixed(2));
    const totalDurationMinutes = Number(
      ((beforeSnapshot.totalDurationMinutes || 0) * deltaFactor).toFixed(2),
    );

    return {
      ...beforeSnapshot,
      jobIds,
      totalDistanceKm,
      totalDurationMinutes,
      dataQuality: preserveDegradedOrSimulatedQuality(beforeSnapshot.dataQuality || 'live'),
      optimizationStatus: 'degraded',
    };
  }

  async previewReroute(
    routeId: string,
    action: RerouteAction,
    payload: Record<string, any> | undefined,
    actor?: DispatchActorContext,
  ) {
    const route = await this.findOne(routeId, actor);
    validateRerouteActionPayload(action, payload, route);
    const beforeSnapshot = this.buildRouteSnapshot(route);
    const afterSnapshot = this.buildAfterSnapshotFromSimulation(
      beforeSnapshot,
      action,
      payload || {},
    );
    const constraintDiagnostics = await this.computeRerouteConstraintDiagnostics({
      route,
      action,
      payload: payload || {},
      beforeSnapshot,
      afterSnapshot,
    });
    const impactSummary = this.computeImpactSummary(beforeSnapshot, afterSnapshot);
    const alternatives = buildRerouteAlternatives(
      action,
      constraintDiagnostics,
      impactSummary,
    );
    await this.logDispatchEvent({
      routeId,
      source: 'reroute',
      level: constraintDiagnostics.feasible ? 'info' : 'warning',
      code: 'REROUTE_PREVIEW_GENERATED',
      message: constraintDiagnostics.feasible
        ? `Reroute preview generated for ${action}`
        : `Reroute preview generated with constraint warnings for ${action}`,
      payload: {
        action,
        feasible: constraintDiagnostics.feasible,
        reasonCodes: constraintDiagnostics.reasonCodes,
        selectedPackId: constraintDiagnostics.selectedPackId,
        packIds: constraintDiagnostics.packDiagnostics.map((pack) => pack.packId),
        reasonCode: constraintDiagnostics.reasonCodes[0] || null,
        feasibilityScore: constraintDiagnostics.feasibilityScore,
      },
      reasonCode: constraintDiagnostics.reasonCodes[0] || null,
      action,
      packId: constraintDiagnostics.selectedPackId,
    });
    return {
      beforeSnapshot,
      afterSnapshot,
      impactSummary,
      impliedDataQuality: afterSnapshot.dataQuality,
      impliedOptimizationStatus: afterSnapshot.optimizationStatus,
      impliedWorkflowStatus: deriveWorkflowRouteStatus(
        route.status,
        afterSnapshot.dataQuality,
        true,
      ),
      dispatchBlocked: isDispatchBlockedByRerouteState(route.routeData?.reroute_state || null),
      constraintDiagnostics,
      alternatives,
      feasibilitySummary: {
        score: constraintDiagnostics.feasibilityScore,
        feasible: constraintDiagnostics.feasible,
        rationale:
          constraintDiagnostics.feasibilityScore >= 80
            ? 'Plan is operationally strong under current deterministic constraints.'
            : constraintDiagnostics.feasibilityScore >= 50
            ? 'Plan is conditionally feasible with notable conflicts.'
            : 'Plan is high-risk or infeasible without intervention.',
      },
    };
  }

  private async executeSplitRoute(
    route: Route,
    payload: Record<string, any>,
  ): Promise<{ childRoute: Route; parentJobIds: string[]; childJobIds: string[] }> {
    const splitAtIndex = payload.splitAtIndex;
    const originalJobIds = [...route.jobIds];
    const { parentJobIds, childJobIds } = splitRouteJobIds(route.jobIds, splitAtIndex);
    assertSplitRouteConsistency(originalJobIds, parentJobIds, childJobIds);

    if (payload.childVehicleId) {
      const childVehicle = await this.vehicleRepository.findOne({
        where: { id: payload.childVehicleId },
      });
      if (!childVehicle) {
        throw new BadRequestException(`split_route childVehicleId not found: ${payload.childVehicleId}`);
      }
    }

    if (payload.childDriverId) {
      const childDriver = await this.driverRepository.findOne({
        where: { id: payload.childDriverId },
      });
      if (!childDriver) {
        throw new BadRequestException(`split_route childDriverId not found: ${payload.childDriverId}`);
      }
    }

    const childRoute = this.routeRepository.create({
      vehicleId: payload.childVehicleId || route.vehicleId,
      driverId:
        typeof payload.childDriverId === 'string'
          ? payload.childDriverId
          : null,
      jobIds: childJobIds,
      routeData: {
        ...(route.routeData || {}),
        parent_route_id: route.id,
        split_route_child: true,
        rerouting: false,
        reroute_state: 'applied',
        warnings: [
          ...(Array.isArray(route.routeData?.warnings) ? route.routeData.warnings : []),
          `Child route created from split of route ${route.id.slice(0, 8)}.`,
        ],
        data_quality: preserveDegradedOrSimulatedQuality(
          this.getRouteDataQualityFromRouteData(route.routeData),
        ),
        optimization_status: 'degraded',
      },
      status: RouteStatus.PLANNED,
      workflowStatus: RouteWorkflowStatus.READY_FOR_DISPATCH,
      totalDistanceKm: null,
      totalDurationMinutes: null,
      jobCount: childJobIds.length,
      polyline: null,
      color: this.getNextRouteColor(),
      eta: null,
      notes: `Split from route ${route.id}`,
    });
    this.syncPersistedWorkflowStatus(childRoute as Route);
    const savedChildRoute = await this.routeRepository.save(childRoute);

    route.jobIds = parentJobIds;
    route.jobCount = parentJobIds.length;
    this.syncPersistedWorkflowStatus(route);
    await this.routeRepository.save(route);

    await this.jobRepository
      .createQueryBuilder()
      .update()
      .set({ assignedRouteId: savedChildRoute.id, status: JobStatus.ASSIGNED })
      .where('id IN (:...ids)', { ids: childJobIds })
      .execute();

    const childJobs = await this.jobRepository.findByIds(childJobIds);
    if (childJobs.length !== childJobIds.length) {
      throw new BadRequestException('split_route failed consistency check for child jobs');
    }
    const misassigned = childJobs.filter((job) => job.assignedRouteId !== savedChildRoute.id);
    if (misassigned.length > 0) {
      throw new BadRequestException('split_route child job reassignment consistency failed');
    }

    return {
      childRoute: savedChildRoute,
      parentJobIds,
      childJobIds,
    };
  }

  async getRerouteHistory(routeId: string, actor?: DispatchActorContext): Promise<RerouteRequest[]> {
    await this.findOne(routeId, actor);
    return this.rerouteRequestRepository.find({
      where: { routeId, ...(actor?.organizationId ? { organizationId: actor.organizationId } : {}) } as any,
      order: { createdAt: 'DESC' },
    });
  }

  async requestReroute(
    routeId: string,
    dto: RequestRerouteDto,
    actor?: DispatchActorContext,
  ): Promise<RerouteRequest> {
    const route = await this.findOne(routeId, actor);
    const now = new Date();
    validateRerouteActionPayload(dto.action as RerouteAction, dto.requestPayload, route);

    const existingOpen = await this.rerouteRequestRepository.findOne({
      where: { routeId, status: 'requested' },
      order: { createdAt: 'DESC' },
    });

    if (existingOpen) {
      throw new BadRequestException(
        `Route ${routeId} already has a pending reroute request (${existingOpen.id})`,
      );
    }

    const beforeSnapshot = this.buildRouteSnapshot(route);
    const simulatedAfterSnapshot = this.buildAfterSnapshotFromSimulation(
      beforeSnapshot,
      dto.action as RerouteAction,
      dto.requestPayload || {},
    );
    const requestConstraintDiagnostics = await this.computeRerouteConstraintDiagnostics({
      route,
      action: dto.action as RerouteAction,
      payload: dto.requestPayload || {},
      beforeSnapshot,
      afterSnapshot: simulatedAfterSnapshot,
    });
    const requestImpactSummary = this.computeImpactSummary(
      beforeSnapshot,
      simulatedAfterSnapshot,
    );
    const rerouteRequest = this.rerouteRequestRepository.create({
      routeId,
      exceptionCategory: dto.exceptionCategory as RerouteExceptionCategory,
      action: dto.action as RerouteAction,
      status: 'requested',
      reason: dto.reason,
      requestPayload: dto.requestPayload || null,
      plannerDiagnostics: {
        ...(dto.plannerDiagnostics || {}),
        advancedConstraints: requestConstraintDiagnostics,
        alternatives: buildRerouteAlternatives(
          dto.action as RerouteAction,
          requestConstraintDiagnostics,
          requestImpactSummary,
        ),
        feasibilitySummary: {
          score: requestConstraintDiagnostics.feasibilityScore,
          feasible: requestConstraintDiagnostics.feasible,
        },
      },
      beforeSnapshot,
      requesterId: this.getActorUserId(actor) || dto.requesterId || null,
      requestedAt: now,
    });

    const saved = await this.rerouteRequestRepository.save(rerouteRequest);

    route.routeData = {
      ...(route.routeData || {}),
      constraint_pack_id:
        typeof dto.requestPayload?.constraintPackId === 'string'
          ? dto.requestPayload.constraintPackId
          : route.routeData?.constraint_pack_id || null,
      reroute_state: 'requested',
      pending_reroute_request_id: saved.id,
      exception_category: dto.exceptionCategory,
      rerouting: true,
      warnings: [
        ...(Array.isArray(route.routeData?.warnings) ? route.routeData.warnings : []),
        `Reroute requested (${dto.action}) due to ${dto.exceptionCategory}.`,
      ],
      data_quality:
        route.status === RouteStatus.IN_PROGRESS
          ? this.getRouteDataQualityFromRouteData(route.routeData) === 'live'
            ? 'degraded'
            : this.getRouteDataQualityFromRouteData(route.routeData)
          : this.getRouteDataQualityFromRouteData(route.routeData),
      optimization_status:
        this.getOptimizationStatusFromRouteData(route.routeData) === 'optimized'
          ? 'degraded'
          : this.getOptimizationStatusFromRouteData(route.routeData),
    };
    this.syncPersistedWorkflowStatus(route);
    await this.routeRepository.save(route);
    this.dispatchGateway.emitRouteUpdated(route);
    await this.logDispatchEvent({
      routeId,
      source: 'reroute',
      level: 'warning',
      code: 'REROUTE_REQUESTED',
      eventType: 'REROUTE_REQUESTED',
      message: `Reroute requested (${dto.action}) due to ${dto.exceptionCategory}`,
      payload: {
        requestId: saved.id,
        action: dto.action,
        exceptionCategory: dto.exceptionCategory,
        reasonCodes: requestConstraintDiagnostics.reasonCodes,
        selectedPackId: requestConstraintDiagnostics.selectedPackId,
        reasonCode: requestConstraintDiagnostics.reasonCodes[0] || null,
      },
      reasonCode: requestConstraintDiagnostics.reasonCodes[0] || null,
      action: dto.action,
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
      packId: requestConstraintDiagnostics.selectedPackId,
    });

    return saved;
  }

  async approveReroute(
    routeId: string,
    requestId: string,
    dto: ReviewRerouteDto,
    actor?: DispatchActorContext,
  ): Promise<RerouteRequest> {
    const route = await this.findOne(routeId, actor);
    const request = await this.findRerouteRequest(routeId, requestId);

    if (!canTransitionRerouteRequest(request.status, 'approved')) {
      throw new BadRequestException(
        `Cannot approve reroute request in status ${request.status}`,
      );
    }

    request.status = 'approved';
    request.reviewerId = this.getActorUserId(actor) || dto.reviewerId || null;
    request.reviewNote = dto.reviewNote || null;
    request.reviewedAt = new Date();
    const saved = await this.rerouteRequestRepository.save(request);

    route.routeData = {
      ...(route.routeData || {}),
      reroute_state: 'approved',
      pending_reroute_request_id: request.id,
      rerouting: true,
      warnings: [
        ...(Array.isArray(route.routeData?.warnings) ? route.routeData.warnings : []),
        `Reroute request ${request.id.slice(0, 8)} approved.`,
      ],
    };
    this.syncPersistedWorkflowStatus(route);
    await this.routeRepository.save(route);
    this.dispatchGateway.emitRouteUpdated(route);
    await this.logDispatchEvent({
      routeId,
      source: 'reroute',
      level: 'info',
      code: 'REROUTE_APPROVED',
      eventType: 'REROUTE_APPROVED',
      message: `Reroute request ${request.id} approved`,
      payload: { requestId: request.id },
      action: request.action,
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
    });

    return saved;
  }

  async rejectReroute(
    routeId: string,
    requestId: string,
    dto: ReviewRerouteDto,
    actor?: DispatchActorContext,
  ): Promise<RerouteRequest> {
    const route = await this.findOne(routeId, actor);
    const request = await this.findRerouteRequest(routeId, requestId);

    if (!canTransitionRerouteRequest(request.status, 'rejected')) {
      throw new BadRequestException(
        `Cannot reject reroute request in status ${request.status}`,
      );
    }

    request.status = 'rejected';
    request.reviewerId = this.getActorUserId(actor) || dto.reviewerId || null;
    request.reviewNote = dto.reviewNote || null;
    request.reviewedAt = new Date();
    const saved = await this.rerouteRequestRepository.save(request);

    route.routeData = {
      ...(route.routeData || {}),
      reroute_state: 'rejected',
      pending_reroute_request_id: null,
      rerouting: false,
      warnings: [
        ...(Array.isArray(route.routeData?.warnings) ? route.routeData.warnings : []),
        `Reroute request ${request.id.slice(0, 8)} rejected.`,
      ],
    };
    this.syncPersistedWorkflowStatus(route);
    await this.routeRepository.save(route);
    this.dispatchGateway.emitRouteUpdated(route);
    await this.logDispatchEvent({
      routeId,
      source: 'reroute',
      level: 'info',
      code: 'REROUTE_REJECTED',
      eventType: 'REROUTE_REJECTED',
      message: `Reroute request ${request.id} rejected`,
      payload: { requestId: request.id },
      action: request.action,
      actor: this.getActorLabel(actor),
      actorUserId: this.getActorUserId(actor),
    });

    return saved;
  }

  async applyReroute(
    routeId: string,
    requestId: string,
    dto: ApplyRerouteDto,
    actor?: DispatchActorContext,
  ): Promise<RerouteRequest> {
    const route = await this.findOne(routeId, actor);
    const request = await this.findRerouteRequest(routeId, requestId);

    if (
      !canTransitionRerouteRequest(request.status, 'applied')
    ) {
      throw new BadRequestException(
        `Cannot apply reroute request in status ${request.status}`,
      );
    }

    const beforeSnapshot = this.buildRouteSnapshot(route);
    const appliedPayload = dto.appliedPayload || {};
    const effectivePayload = {
      ...(request.requestPayload || {}),
      ...appliedPayload,
    };
    validateRerouteActionPayload(request.action as RerouteAction, effectivePayload, route);
    const simulatedAfterSnapshot = this.buildAfterSnapshotFromSimulation(
      beforeSnapshot,
      request.action as RerouteAction,
      effectivePayload,
    );
    const constraintDiagnostics = await this.computeRerouteConstraintDiagnostics({
      route,
      action: request.action as RerouteAction,
      payload: effectivePayload,
      beforeSnapshot,
      afterSnapshot: simulatedAfterSnapshot,
    });
    const overrideRequested = dto.overrideRequested === true;
    const overrideReason = (dto.overrideReason || '').trim();
    const overrideActor = dto.overrideActor || dto.appliedBy || 'unknown';
    if (!constraintDiagnostics.feasible && !overrideRequested) {
      await this.logDispatchEvent({
        routeId,
        source: 'reroute',
        level: 'error',
        code: 'REROUTE_APPLY_BLOCKED_CONSTRAINTS',
        eventType: 'REROUTE_APPLY_BLOCKED_CONSTRAINTS',
        message: `Reroute apply blocked for ${request.action}`,
        payload: {
          requestId: request.id,
          reasonCodes: constraintDiagnostics.reasonCodes,
          infeasibleJobReasonCodes: constraintDiagnostics.infeasibleJobReasonCodes,
          selectedPackId: constraintDiagnostics.selectedPackId,
        },
        reasonCode: constraintDiagnostics.reasonCodes[0] || null,
        action: request.action,
        packId: constraintDiagnostics.selectedPackId,
      });
      throw new BadRequestException(
        `Reroute apply blocked by constraints: ${constraintDiagnostics.reasonCodes.join(', ')}`,
      );
    }
    validateRerouteOverride({
      overrideRequested,
      overrideReason,
      overrideActorRole: dto.overrideActorRole,
      blockedReasonCodes: constraintDiagnostics.reasonCodes,
    });
    if (!constraintDiagnostics.feasible && overrideRequested) {
      await this.logDispatchEvent({
        routeId,
        source: 'reroute',
        level: 'warning',
        code: 'REROUTE_APPLY_OVERRIDE_APPROVED',
        eventType: 'REROUTE_APPLY_OVERRIDE_APPROVED',
        message: `Operator override applied for infeasible reroute action ${request.action}`,
        payload: {
          requestId: request.id,
          overrideActor,
          overrideReason,
          reasonCodes: constraintDiagnostics.reasonCodes,
          overrideActorRole: dto.overrideActorRole || 'unknown',
        },
        reasonCode: constraintDiagnostics.reasonCodes[0] || null,
        action: request.action,
        actor: overrideActor,
        actorUserId: overrideActor,
        packId: constraintDiagnostics.selectedPackId,
      });
    }

    await this.ensurePlanningDraftVersion(route, actor, 'apply_reroute');

    // Deterministic reroute actions for this sprint foundation.
    if (
      request.action === 'reorder_stops' &&
      Array.isArray(effectivePayload.newJobOrder)
    ) {
      const newJobOrder = effectivePayload.newJobOrder as string[];
      const invalidJobs = newJobOrder.filter((jobId) => !route.jobIds.includes(jobId));
      if (invalidJobs.length > 0 || newJobOrder.length !== route.jobIds.length) {
        throw new BadRequestException('Invalid newJobOrder for reorder_stops');
      }
      route.jobIds = newJobOrder;
    } else if (request.action === 'remove_stop' && typeof effectivePayload.jobId === 'string') {
      route.jobIds = route.jobIds.filter((id) => id !== effectivePayload.jobId);
      await this.jobRepository
        .createQueryBuilder()
        .update()
        .set({ status: JobStatus.PENDING, assignedRouteId: null })
        .where('id = :id', { id: effectivePayload.jobId })
        .execute();
    } else if (request.action === 'hold_stop' && typeof effectivePayload.jobId === 'string') {
      const heldJobId = effectivePayload.jobId;
      route.jobIds = [...route.jobIds.filter((id) => id !== heldJobId), heldJobId];
    } else if (
      request.action === 'reassign_driver' &&
      typeof effectivePayload.driverId === 'string'
    ) {
      route.driverId = effectivePayload.driverId;
    } else if (
      request.action === 'reassign_stop_to_route' &&
      typeof effectivePayload.jobId === 'string'
    ) {
      const targetRouteId = effectivePayload.targetRouteId;
      const targetRoute = await this.routeRepository.findOne({
        where: { id: targetRouteId },
      });
      if (!targetRoute) {
        throw new BadRequestException(`Target route not found: ${targetRouteId}`);
      }
      if ([RouteStatus.COMPLETED, RouteStatus.CANCELLED].includes(targetRoute.status)) {
        throw new BadRequestException(
          `Cannot move stop to ${targetRoute.status} target route`,
        );
      }
      await this.ensurePlanningDraftVersion(
        targetRoute,
        actor,
        'apply_reroute_target_route',
      );
      route.jobIds = route.jobIds.filter((id) => id !== effectivePayload.jobId);
      route.jobCount = route.jobIds.length;
      this.syncPersistedWorkflowStatus(route);

      targetRoute.jobIds = Array.from(
        new Set([...(targetRoute.jobIds || []), effectivePayload.jobId]),
      );
      targetRoute.jobCount = targetRoute.jobIds.length;
      targetRoute.routeData = {
        ...(targetRoute.routeData || {}),
        warnings: [
          ...(Array.isArray(targetRoute.routeData?.warnings) ? targetRoute.routeData.warnings : []),
          `Stop ${effectivePayload.jobId} reassigned from route ${route.id.slice(0, 8)}.`,
        ],
      };
      this.syncPersistedWorkflowStatus(targetRoute);
      await this.routeRepository.save(targetRoute);

      await this.jobRepository
        .createQueryBuilder()
        .update()
        .set({ status: JobStatus.ASSIGNED, assignedRouteId: targetRoute.id })
        .where('id = :id', { id: effectivePayload.jobId })
        .execute();

      this.dispatchGateway.emitRouteUpdated(targetRoute);
      await this.logDispatchEvent({
        routeId: targetRoute.id,
        source: 'reroute',
        level: 'info',
        code: 'REROUTE_STOP_REASSIGNED_TO_ROUTE',
        eventType: 'REROUTE_STOP_REASSIGNED_TO_ROUTE',
        message: `Stop ${effectivePayload.jobId} moved from ${route.id} to ${targetRoute.id}`,
        payload: {
          sourceRouteId: route.id,
          targetRouteId: targetRoute.id,
          jobId: effectivePayload.jobId,
        },
      });
    } else if (request.action === 'split_route') {
      const { childRoute, childJobIds } = await this.executeSplitRoute(route, effectivePayload);
      route.routeData = {
        ...(route.routeData || {}),
        split_route_child_route_id: childRoute.id,
        split_route_moved_job_ids: childJobIds,
      };
      this.dispatchGateway.emitRouteCreated(childRoute);
    }

    request.status = 'applied';
    request.appliedBy = this.getActorUserId(actor) || dto.appliedBy || null;
    request.appliedAt = new Date();
    request.afterSnapshot = this.buildRouteSnapshot(route);
    request.impactSummary = this.computeImpactSummary(beforeSnapshot, request.afterSnapshot);
    request.plannerDiagnostics = {
      ...(request.plannerDiagnostics || {}),
      advancedConstraints: constraintDiagnostics,
      alternatives: buildRerouteAlternatives(
        request.action as RerouteAction,
        constraintDiagnostics,
        request.impactSummary as any,
      ),
      feasibilitySummary: {
        score: constraintDiagnostics.feasibilityScore,
        feasible: constraintDiagnostics.feasible,
      },
      override: !constraintDiagnostics.feasible && overrideRequested
        ? {
            applied: true,
            actor: overrideActor,
            reason: overrideReason,
            appliedAt: new Date().toISOString(),
            blockedReasonCodes: constraintDiagnostics.reasonCodes,
          }
        : undefined,
    };
    if (Object.keys(effectivePayload).length > 0) {
      request.requestPayload = {
        ...(request.requestPayload || {}),
        appliedPayload: effectivePayload,
      };
    }
    const saved = await this.rerouteRequestRepository.save(request);

    route.routeData = {
      ...(route.routeData || {}),
      reroute_state: 'applied',
      pending_reroute_request_id: null,
      rerouting: false,
      data_quality: preserveDegradedOrSimulatedQuality(
        this.getRouteDataQualityFromRouteData(route.routeData),
      ),
      optimization_status: 'degraded',
      warnings: [
        ...(Array.isArray(route.routeData?.warnings) ? route.routeData.warnings : []),
        `Reroute request ${request.id.slice(0, 8)} applied.`,
      ],
      reroute_impact_summary: saved.impactSummary || null,
      planner_diagnostics: request.plannerDiagnostics || null,
    };
    this.syncPersistedWorkflowStatus(route);
    await this.routeRepository.save(route);
    this.dispatchGateway.emitRouteUpdated(route);
    await this.logDispatchEvent({
      routeId,
      source: 'reroute',
      level: 'warning',
      code: 'REROUTE_APPLIED',
      eventType: 'REROUTE_APPLIED',
      message: `Reroute request ${request.id} applied (${request.action})`,
      payload: {
        requestId: request.id,
        action: request.action,
        impactSummary: saved.impactSummary,
        reasonCodes: constraintDiagnostics.reasonCodes,
        overrideApplied: !constraintDiagnostics.feasible && overrideRequested,
        overrideActor: !constraintDiagnostics.feasible && overrideRequested ? overrideActor : null,
        reasonCode: constraintDiagnostics.reasonCodes[0] || null,
        selectedPackId: constraintDiagnostics.selectedPackId,
      },
      reasonCode: constraintDiagnostics.reasonCodes[0] || null,
      action: request.action,
      actor: !constraintDiagnostics.feasible && overrideRequested ? overrideActor : this.getActorLabel(actor),
      actorUserId:
        !constraintDiagnostics.feasible && overrideRequested
          ? overrideActor
          : this.getActorUserId(actor),
      packId: constraintDiagnostics.selectedPackId,
    });

    return saved;
  }

  /**
   * Get statistics
   */
  async getStatistics(actor?: DispatchActorContext) {
    if (!actor?.organizationId) {
      throw new ForbiddenException('Organization scope required');
    }

    const [byStatus, total] = await Promise.all([
      this.routeRepository
        .createQueryBuilder('route')
        .where('route.organizationId = :organizationId', { organizationId: actor.organizationId })
        .select('route.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('route.status')
        .getRawMany(),
      this.routeRepository.count({ where: { organizationId: actor.organizationId } as any }),
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
