import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import {
  evaluateJobRoutingReadiness,
  evaluateVehicleLoadFit,
  estimateJobLoad,
  getOptimizationObjectiveLabel,
  normalizeOptimizationObjective,
  type OptimizationObjective,
} from '../../../../shared/contracts';
import { AuditService } from '../../common/audit/audit.service';
import {
  OptimizeRequest,
  OptimizeResponse,
} from '../dispatch/dto/routing-service.dto';
import { Driver } from '../drivers/entities/driver.entity';
import { Job, JobPriority, JobStatus } from '../jobs/entities/job.entity';
import { JobStop } from '../jobs/entities/job-stop.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Route, RouteStatus, RouteWorkflowStatus } from '../dispatch/entities/route.entity';
import { RouteAssignment } from '../dispatch/entities/route-assignment.entity';
import { RouteRunStop } from '../dispatch/entities/route-run-stop.entity';
import { Depot } from '../depots/entities/depot.entity';
import { RoutePlan, type RoutePlanPublishDecision } from './entities/route-plan.entity';
import { RoutePlanGroup } from './entities/route-plan-group.entity';
import { RoutePlanStop } from './entities/route-plan-stop.entity';
import { GenerateRoutePlanDto } from './dto/generate-route-plan.dto';
import { UpdateRoutePlanGroupDto } from './dto/update-route-plan-group.dto';
import { UpdateRoutePlanStopDto } from './dto/update-route-plan-stop.dto';
import { AcceptPublishRiskDto } from './dto/accept-publish-risk.dto';
import { InsertRoutePlanJobDto } from './dto/insert-route-plan-job.dto';
import { BatchMoveRoutePlanStopsDto } from './dto/batch-move-route-plan-stops.dto';
import {
  resolveRoutingServiceUrl,
  routingServiceAuthHeaders,
} from '../../common/routing/routing-service-url.util';
import {
  calculateRouteDriverFamiliarity,
  DRIVER_FAMILIARITY_MIN_ROUTES,
  DRIVER_FAMILIARITY_MIN_STOPS,
  DRIVER_FAMILIARITY_RADIUS_KM,
  type DriverHistoricalVisit,
  type FamiliarityLocation,
} from './driver-familiarity';

type Actor = {
  userId?: string;
  email?: string;
  organizationId?: string;
  roles?: string[];
};

type PlannedJobBundle = {
  job: Job;
  stops: JobStop[];
  weight: number;
  volume: number;
  serviceMinutes: number;
  location: { lat: number; lng: number };
  windowStart: Date | null;
  windowEnd: Date | null;
  lockedVehicleId?: string | null;
  sortKey: string;
};

type DraftGroupAllocation = {
  entity: RoutePlanGroup;
  bundles: PlannedJobBundle[];
  weight: number;
  volume: number;
  minutes: number;
};

type VehiclePlanningMetadata = {
  maxShiftMinutes?: number;
};

type DraftPlanComputation = {
  groups: RoutePlanGroup[];
  stops: RoutePlanStop[];
  metrics: Record<string, unknown>;
  warnings: Array<string | Record<string, unknown>>;
};

type PublishBlocker = {
  code: string;
  message: string;
  severity: 'blocking';
  canAcceptRisk: boolean;
  groupId?: string;
  jobId?: string;
  warningIndex?: number;
  acceptedDecision?: RoutePlanPublishDecision;
};

const ACTIVE_ROUTE_PLAN_STATUSES: RoutePlan['status'][] = [
  'DRAFT',
  'READY',
  'PUBLISHED',
];
const DRIVER_FAMILIARITY_LOOKBACK_DAYS = 365;
const DRIVER_FAMILIARITY_ROUTE_LIMIT = 500;

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toWholeMinutes(value: unknown) {
  return Math.max(0, Math.round(toNumber(value)));
}

function isObjectRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function priorityWeight(priority?: string) {
  switch (String(priority || '').toLowerCase()) {
    case JobPriority.URGENT:
      return 4;
    case JobPriority.HIGH:
      return 3;
    case JobPriority.NORMAL:
      return 2;
    default:
      return 1;
  }
}

@Injectable()
export class PlanningService {
  private readonly logger = new Logger(PlanningService.name);
  private readonly routingServiceUrl: string;

  constructor(
    @InjectRepository(RoutePlan)
    private readonly routePlans: Repository<RoutePlan>,
    @InjectRepository(RoutePlanGroup)
    private readonly routePlanGroups: Repository<RoutePlanGroup>,
    @InjectRepository(RoutePlanStop)
    private readonly routePlanStops: Repository<RoutePlanStop>,
    @InjectRepository(Job)
    private readonly jobs: Repository<Job>,
    @InjectRepository(JobStop)
    private readonly jobStops: Repository<JobStop>,
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Driver)
    private readonly drivers: Repository<Driver>,
    @InjectRepository(Depot)
    private readonly depots: Repository<Depot>,
    @InjectRepository(Route)
    private readonly routes: Repository<Route>,
    @InjectRepository(RouteRunStop)
    private readonly routeRunStops: Repository<RouteRunStop>,
    @InjectRepository(RouteAssignment)
    private readonly routeAssignments: Repository<RouteAssignment>,
    private readonly dataSource: DataSource,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.routingServiceUrl = resolveRoutingServiceUrl(this.configService);
  }

  private requireOrganizationId(actor?: Actor) {
    const organizationId = actor?.organizationId;
    if (!organizationId) throw new BadRequestException('organization context required');
    return organizationId;
  }

  private demandForJob(job: Job) {
    const estimate = estimateJobLoad({
      weight: job.weight,
      volume: job.volume,
      quantity: job.quantity,
      routingRequirements: job.routingRequirements,
    });
    return {
      weightKg: toNumber(estimate.totalWeightKg),
      volumeM3: toNumber(estimate.totalVolumeM3),
    };
  }

  private sequenceConstraintIssues(orderedJobIds: string[], jobs: Job[]) {
    const jobById = new Map(jobs.map((job) => [job.id, job]));
    const distinctJobIds = orderedJobIds.filter(
      (jobId, index) => orderedJobIds.indexOf(jobId) === index,
    );
    return distinctJobIds.flatMap((jobId, index) => {
      const position = jobById.get(jobId)?.routingRequirements?.sequence?.position;
      if (position === 'first' && index !== 0) {
        return [{
          code: 'STOP_MUST_BE_FIRST',
          message: `${jobById.get(jobId)?.customerName || jobId} must be the first job on its route.`,
          jobId,
        }];
      }
      if (position === 'last' && index !== distinctJobIds.length - 1) {
        return [{
          code: 'STOP_MUST_BE_LAST',
          message: `${jobById.get(jobId)?.customerName || jobId} must be the last job on its route.`,
          jobId,
        }];
      }
      return [];
    });
  }

  private async ensureDepot(organizationId: string, depotId?: string) {
    if (depotId) {
      const depot = await this.depots.findOne({ where: { id: depotId, organizationId } });
      if (!depot) throw new NotFoundException(`Depot not found: ${depotId}`);
      return depot;
    }
    let depot = await this.depots.findOne({ where: { organizationId, isPrimary: true } });
    if (!depot) {
      depot = await this.depots.save(this.depots.create({
        organizationId,
        name: 'Primary Depot',
        address: 'Dispatch HQ',
        location: { lat: 39.0997, lng: -94.5786 },
        isPrimary: true,
      }));
    }
    return depot;
  }

  private async ensureJobStopsForJobs(jobs: Job[], organizationId: string) {
    const jobIds = jobs.map((job) => job.id);
    const existing = jobIds.length
      ? await this.jobStops.find({ where: { jobId: In(jobIds) }, order: { stopOrder: 'ASC' } })
      : [];
    const byJob = new Map<string, JobStop[]>();
    for (const stop of existing) {
      const bucket = byJob.get(stop.jobId) || [];
      bucket.push(stop);
      byJob.set(stop.jobId, bucket);
    }

    for (const job of jobs) {
      if (byJob.has(job.id) && byJob.get(job.id)?.length) continue;
      const generated: JobStop[] = [];
      if (job.pickupAddress) {
        generated.push(this.jobStops.create({
          organizationId,
          jobId: job.id,
          stopOrder: 1,
          stopType: 'PICKUP',
          address: job.pickupAddress,
          location: job.pickupLocation || null,
          serviceDurationMinutes: Math.max(5, Math.round(toNumber(job.estimatedDuration) / 2) || 10),
          timeWindowStart: job.timeWindowStart,
          timeWindowEnd: job.timeWindowEnd,
          demandWeightKg: this.demandForJob(job).weightKg || null,
          demandVolumeM3: this.demandForJob(job).volumeM3 || null,
          notes: job.specialInstructions || job.notes || null,
        }));
      }
      generated.push(this.jobStops.create({
        organizationId,
        jobId: job.id,
        stopOrder: generated.length + 1,
        stopType: 'DROPOFF',
        address: job.deliveryAddress,
        location: job.deliveryLocation || null,
        serviceDurationMinutes: Math.max(10, Math.round(toNumber(job.estimatedDuration)) || 15),
        timeWindowStart: job.timeWindowStart,
        timeWindowEnd: job.timeWindowEnd,
        demandWeightKg: this.demandForJob(job).weightKg || null,
        demandVolumeM3: this.demandForJob(job).volumeM3 || null,
        notes: job.specialInstructions || job.notes || null,
      }));
      const saved = await this.jobStops.save(generated);
      byJob.set(job.id, saved);
    }

    return byJob;
  }

  private buildJobBundles(
    jobs: Job[],
    stopsByJob: Map<string, JobStop[]>,
    lockedVehicleByJobId: Map<string, string>,
  ) {
    return jobs.map((job) => {
      const stops = (stopsByJob.get(job.id) || []).slice().sort((a, b) => a.stopOrder - b.stopOrder);
      const firstWindow = stops[0]?.timeWindowStart || job.timeWindowStart || null;
      const windowStart = stops.reduce<Date | null>((current, stop) => {
        const candidate = stop.timeWindowStart || null;
        if (!candidate) return current;
        if (!current || candidate < current) return candidate;
        return current;
      }, job.timeWindowStart || null);
      const windowEnd = stops.reduce<Date | null>((current, stop) => {
        const candidate = stop.timeWindowEnd || null;
        if (!candidate) return current;
        if (!current || candidate > current) return candidate;
        return current;
      }, job.timeWindowEnd || null);
      const deliveryStop =
        stops.find(
          (stop) =>
            stop.stopType === 'DROPOFF' &&
            stop.location &&
            Number.isFinite(Number(stop.location.lat)) &&
            Number.isFinite(Number(stop.location.lng)),
        ) ||
        stops.find(
          (stop) =>
            stop.location &&
            Number.isFinite(Number(stop.location.lat)) &&
            Number.isFinite(Number(stop.location.lng)),
        );
      const location = deliveryStop?.location || job.deliveryLocation || job.pickupLocation;
      if (
        !location ||
        !Number.isFinite(Number(location.lat)) ||
        !Number.isFinite(Number(location.lng))
      ) {
        throw new BadRequestException(
          `Job ${job.id} is missing planner coordinates for optimization.`,
        );
      }
      const demand = this.demandForJob(job);
      return {
        job,
        stops,
        weight: demand.weightKg,
        volume: demand.volumeM3,
        serviceMinutes: stops.reduce((sum, stop) => sum + Math.max(1, stop.serviceDurationMinutes || 0), 0),
        location: {
          lat: Number(location.lat),
          lng: Number(location.lng),
        },
        windowStart,
        windowEnd,
        lockedVehicleId: lockedVehicleByJobId.get(job.id) || null,
        sortKey: [
          10 - priorityWeight(job.priority),
          firstWindow ? new Date(firstWindow).toISOString() : '9999-12-31T00:00:00.000Z',
          job.id,
        ].join('|'),
      } satisfies PlannedJobBundle;
    }).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  private getVehiclePlanningMetadata(vehicle: Vehicle): VehiclePlanningMetadata {
    return isObjectRecord(vehicle.metadata)
      ? {
          maxShiftMinutes:
            typeof vehicle.metadata.maxShiftMinutes === 'number'
              ? vehicle.metadata.maxShiftMinutes
              : undefined,
        }
      : {};
  }

  private capacityForVehicle(vehicle: Vehicle) {
    const metadata = this.getVehiclePlanningMetadata(vehicle);
    return {
      maxWeight: toNumber(vehicle.capacityWeightKg) || 999999,
      maxVolume: toNumber(vehicle.capacityVolumeM3) || 999999,
      maxShiftMinutes: toNumber(metadata.maxShiftMinutes) || 480,
    };
  }

  private resolveOptimizationObjective(
    value?: string | null,
  ): OptimizationObjective {
    return normalizeOptimizationObjective(value || 'distance');
  }

  private getPlannerVehicleCoordinates(
    vehicle: Vehicle,
    depot: Depot,
  ) {
    const lat = Number(vehicle.currentLocation?.lat ?? depot.location?.lat);
    const lng = Number(vehicle.currentLocation?.lng ?? depot.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException(
        `Vehicle ${vehicle.id} is missing planner start coordinates.`,
      );
    }
    return { lat, lng };
  }

  private buildLockedVehicleByJobId(
    lockedStops: Map<string, RoutePlanStop>,
    previousGroups: RoutePlanGroup[],
    bundles: PlannedJobBundle[],
  ) {
    const groupVehicleById = new Map(
      previousGroups.map((group) => [group.id, group.vehicleId || null]),
    );
    const lockedVehicleByJobId = new Map<string, string>();

    for (const bundle of bundles) {
      for (const stop of bundle.stops) {
        const locked = lockedStops.get(stop.id);
        if (!locked) continue;
        const vehicleId = groupVehicleById.get(locked.routePlanGroupId);
        if (vehicleId) {
          lockedVehicleByJobId.set(bundle.job.id, vehicleId);
          break;
        }
      }
    }

    return lockedVehicleByJobId;
  }

  private buildPlannerOptimizeRequest(params: {
    depot: Depot;
    serviceDate: string;
    objective: OptimizationObjective;
    vehicles: Vehicle[];
    bundles: PlannedJobBundle[];
    groups: DraftGroupAllocation[];
    drivers: Driver[];
  }): OptimizeRequest {
    const planDate = new Date(`${params.serviceDate}T08:00:00.000Z`);
    const driverById = new Map(params.drivers.map((driver) => [driver.id, driver]));
    const driverByVehicleId = new Map(
      params.groups.flatMap((group) =>
        group.entity.vehicleId && group.entity.driverId
          ? [[group.entity.vehicleId, driverById.get(group.entity.driverId) || null] as const]
          : [],
      ),
    );
    const fitFor = (vehicle: Vehicle, bundle: PlannedJobBundle) =>
      evaluateVehicleLoadFit({
        vehicle,
        driver: driverByVehicleId.get(vehicle.id) || null,
        jobs: [bundle.job],
      });
    return {
      plan_date: planDate.toISOString(),
      depot_id: params.depot.id,
      objective: params.objective,
      vehicles: params.vehicles.map((vehicle) => {
        const start = this.getPlannerVehicleCoordinates(vehicle, params.depot);
        const capacity = this.capacityForVehicle(vehicle);
        return {
          id: vehicle.id,
          start_lat: start.lat,
          start_lng: start.lng,
          end_lat: Number(params.depot.location?.lat ?? start.lat),
          end_lng: Number(params.depot.location?.lng ?? start.lng),
          capacity_weight: capacity.maxWeight,
          capacity_volume: capacity.maxVolume,
          capacity_pallet_positions:
            evaluateVehicleLoadFit({ vehicle, jobs: [] }).limits.palletPositions || 0,
          driver_id: driverByVehicleId.get(vehicle.id)?.id || null,
          max_route_minutes: capacity.maxShiftMinutes,
        };
      }),
      stops: params.bundles.map((bundle) => {
        const fits = params.vehicles.map((vehicle) => ({
          vehicle,
          fit: fitFor(vehicle, bundle),
        }));
        const eligible = fits.filter(({ fit }) => fit.fits);
        const lockedEligible = bundle.lockedVehicleId
          ? eligible.filter(({ vehicle }) => vehicle.id === bundle.lockedVehicleId)
          : eligible;
        return {
          id: bundle.job.id,
          lat: bundle.location.lat,
          lng: bundle.location.lng,
          service_minutes: Math.max(1, Math.round(bundle.serviceMinutes)),
          tw_start: bundle.windowStart?.toISOString(),
          tw_end: bundle.windowEnd?.toISOString(),
          priority: priorityWeight(bundle.job.priority),
          weight: bundle.weight,
          volume: bundle.volume,
          locked_vehicle_id: bundle.lockedVehicleId || null,
          allowed_vehicle_ids: lockedEligible.map(({ vehicle }) => vehicle.id),
          pallet_positions: eligible.length
            ? Math.min(...eligible.map(({ fit }) => fit.totals.floorPositionsNeeded))
            : 0,
          sequence_constraint:
            bundle.job.routingRequirements?.sequence?.position || 'any',
        };
      }),
    };
  }

  private async callPlannerOptimizer(
    request: OptimizeRequest,
  ): Promise<OptimizeResponse> {
    const requestUrl = `${this.routingServiceUrl}/optimize`;
    const response = (await firstValueFrom(
      this.httpService.post<OptimizeResponse>(requestUrl, request, {
        timeout: 60_000,
        headers: routingServiceAuthHeaders(this.configService),
      }) as any,
    )) as { data?: OptimizeResponse };
    const data = response?.data as OptimizeResponse;
    if (!data || !Array.isArray(data.routes)) {
      throw new BadRequestException(
        'Planner optimizer returned an invalid response.',
      );
    }
    return data;
  }

  private async computeSolverDraft(params: {
    plan: RoutePlan;
    depot: Depot;
    objective: OptimizationObjective;
    bundles: PlannedJobBundle[];
    availableVehicles: Vehicle[];
    drivers: Driver[];
    lockedStops: Map<string, RoutePlanStop>;
  }): Promise<DraftPlanComputation> {
    const groups = this.createDraftGroups(
      params.plan.id,
      params.availableVehicles,
      params.drivers,
    );
    const request = this.buildPlannerOptimizeRequest({
      depot: params.depot,
      serviceDate: params.plan.serviceDate,
      objective: params.objective,
      vehicles: params.availableVehicles,
      bundles: params.bundles,
      groups,
      drivers: params.drivers,
    });
    const optimizeResponse = await this.callPlannerOptimizer(request);
    const objectiveUsed = this.resolveOptimizationObjective(
      optimizeResponse.objective_used || params.objective,
    );
    const groupByVehicleId = new Map(
      groups
        .filter((group) => group.entity.vehicleId)
        .map((group) => [group.entity.vehicleId as string, group]),
    );
    const bundleByJobId = new Map(
      params.bundles.map((bundle) => [bundle.job.id, bundle]),
    );
    const assignedJobIds = new Set<string>();

    for (const route of optimizeResponse.routes) {
      const targetGroup = groupByVehicleId.get(route.vehicle_id);
      if (!targetGroup) continue;
      targetGroup.entity.totalDistanceKm = Number(
        (route.total_distance_m / 1000).toFixed(2),
      );
      targetGroup.entity.totalDurationMinutes = toWholeMinutes(route.total_duration_s / 60);
      targetGroup.entity.warnings = [];
      for (const orderedStop of route.ordered_stops) {
        const bundle = bundleByJobId.get(orderedStop.stop_id);
        if (!bundle || assignedJobIds.has(bundle.job.id)) continue;
        assignedJobIds.add(bundle.job.id);
        targetGroup.bundles.push(bundle);
        targetGroup.weight += bundle.weight;
        targetGroup.volume += bundle.volume;
        targetGroup.minutes += bundle.serviceMinutes;
      }
    }

    const savedGroups = await this.routePlanGroups.save(
      groups.map((group) => ({
        ...group.entity,
        totalWeightKg: Number(group.weight.toFixed(2)),
        totalVolumeM3: Number(group.volume.toFixed(2)),
        serviceTimeMinutes: group.bundles.reduce(
          (sum, bundle) => sum + bundle.serviceMinutes,
          0,
        ),
        totalDurationMinutes:
          group.entity.totalDurationMinutes ||
          toWholeMinutes(group.minutes),
        totalDistanceKm:
          group.entity.totalDistanceKm ||
          Number((group.minutes * 0.85).toFixed(2)),
        warnings: this.buildGroupFleetWarnings(
          group,
          params.availableVehicles,
          params.drivers,
        ),
      })),
    );

    const savedGroupByVehicleId = new Map(
      savedGroups
        .filter((group) => group.vehicleId)
        .map((group) => [group.vehicleId as string, group]),
    );

    const planStops: RoutePlanStop[] = [];
    for (const route of optimizeResponse.routes) {
      const savedGroup = savedGroupByVehicleId.get(route.vehicle_id);
      if (!savedGroup) continue;
      let sequence = 1;
      const usedSequences = new Set<number>();
      for (const orderedStop of route.ordered_stops) {
        const bundle = bundleByJobId.get(orderedStop.stop_id);
        if (!bundle) continue;
        for (const stop of bundle.stops) {
          const locked = params.lockedStops.get(stop.id);
          const stopSequence = this.resolveStopSequence(
            locked?.stopSequence,
            usedSequences,
            sequence,
          );
          planStops.push(
            this.routePlanStops.create({
              routePlanId: params.plan.id,
              routePlanGroupId: savedGroup.id,
              jobId: bundle.job.id,
              jobStopId: stop.id,
              stopSequence,
              isLocked: Boolean(locked?.isLocked),
              plannedArrival:
                locked?.plannedArrival ||
                stop.timeWindowStart ||
                bundle.windowStart,
              plannedDeparture:
                locked?.plannedDeparture ||
                stop.timeWindowEnd ||
                bundle.windowEnd,
              metadata: {
                stopType: stop.stopType,
                address: stop.address,
                objective: objectiveUsed,
              },
            }),
          );
          sequence = Math.max(sequence + 1, stopSequence + 1);
        }
      }
    }

    const unassigned = params.bundles
      .filter((bundle) => !assignedJobIds.has(bundle.job.id))
      .map((bundle) => {
        const reasonCodes =
          optimizeResponse.unassigned_reasons?.[bundle.job.id] || [
            'NO_FEASIBLE_ROUTE',
          ];
        const reasonLabels: Record<string, string> = {
          NO_ELIGIBLE_VEHICLE: 'no driver–vehicle combination satisfies the job rules',
          PALLET_POSITIONS_EXCEEDED: 'the load needs more pallet floor positions than the fleet provides',
          STOP_SEQUENCE_CONSTRAINT: 'the first/last stop rule could not be satisfied',
          NO_FEASIBLE_ROUTE: 'no feasible route satisfies all current constraints',
        };
        return {
          jobId: bundle.job.id,
          reasonCodes,
          reason: reasonCodes.map((code) => reasonLabels[code] || code).join('; '),
        };
      });

    return {
      groups: savedGroups,
      stops: planStops,
      metrics: {
        routeCount: optimizeResponse.routes.filter(
          (route) => route.ordered_stops.length > 0,
        ).length,
        assignedJobCount: assignedJobIds.size,
        unassignedJobCount: unassigned.length,
        totalDistanceKm: Number(
          (
            optimizeResponse.routes.reduce(
              (sum, route) => sum + route.total_distance_m,
              0,
            ) / 1000
          ).toFixed(2),
        ),
        totalDurationMinutes: Number(
          (
            optimizeResponse.routes.reduce(
              (sum, route) => sum + route.total_duration_s,
              0,
            ) / 60
          ).toFixed(2),
        ),
      },
      warnings: [
        ...optimizeResponse.warnings.filter(
          (warning) => !warning.toLowerCase().includes('straight-line estimates'),
        ),
        ...unassigned.map((item) => ({ ...item, type: 'UNASSIGNED_JOB' })),
        {
          type: 'OPTIMIZER_OBJECTIVE',
          objectiveUsed,
          label: getOptimizationObjectiveLabel(objectiveUsed),
        },
        {
          type: optimizeResponse.provenance.fallback_used
            ? 'OPTIMIZER_DEGRADED_MATRIX'
            : 'OPTIMIZER_PROVENANCE',
          solver: optimizeResponse.provenance.solver,
          solverVersion: optimizeResponse.provenance.solver_version,
          matrixProvider: optimizeResponse.provenance.matrix_provider,
          matrixMode: optimizeResponse.provenance.matrix_mode,
          fallbackUsed: optimizeResponse.provenance.fallback_used,
          solveDurationMs: optimizeResponse.provenance.solve_duration_ms,
          coordinateCoveragePercent:
            optimizeResponse.provenance.coordinate_coverage_percent,
          locationCount: optimizeResponse.provenance.location_count,
        },
      ],
    };
  }

  private async computeFallbackDraft(params: {
    plan: RoutePlan;
    bundles: PlannedJobBundle[];
    availableVehicles: Vehicle[];
    drivers: Driver[];
    lockedStops: Map<string, RoutePlanStop>;
    baseWarnings: Array<string | Record<string, unknown>>;
  }): Promise<DraftPlanComputation> {
    const draftGroups = this.createDraftGroups(
      params.plan.id,
      params.availableVehicles,
      params.drivers,
    );
    const { groups: allocatedGroups, unassigned } = this.allocateBundlesToGroups(
      params.bundles,
      draftGroups,
      params.availableVehicles,
      params.drivers,
    );
    const savedGroups = await this.saveDraftGroups(
      allocatedGroups,
      params.availableVehicles,
      params.drivers,
    );
    const planStops = this.buildDraftPlanStops(
      params.plan.id,
      savedGroups,
      allocatedGroups,
      params.lockedStops,
    );
    return {
      groups: savedGroups,
      stops: planStops,
      metrics: {
        routeCount: savedGroups.length,
        assignedJobCount: allocatedGroups.reduce(
          (sum, group) => sum + group.bundles.length,
          0,
        ),
        unassignedJobCount: unassigned.length,
        totalDistanceKm: savedGroups.reduce(
          (sum, group) => sum + toNumber(group.totalDistanceKm),
          0,
        ),
        totalDurationMinutes: savedGroups.reduce(
          (sum, group) => sum + toNumber(group.totalDurationMinutes),
          0,
        ),
      },
      warnings: [
        ...params.baseWarnings,
        ...unassigned.map((item) => ({ ...item, type: 'UNASSIGNED_JOB' })),
      ],
    };
  }

  private createDraftGroups(
    routePlanId: string,
    availableVehicles: Vehicle[],
    drivers: Driver[],
  ): DraftGroupAllocation[] {
    const groups: DraftGroupAllocation[] = [];
    const availableDrivers = [...drivers];
    for (let index = 0; index < Math.max(availableVehicles.length, 1); index += 1) {
      const vehicle = availableVehicles[index];
      const driverIndex = vehicle
        ? availableDrivers.findIndex((candidate) =>
            evaluateVehicleLoadFit({
              vehicle,
              driver: candidate,
              jobs: [],
            }).fits,
          )
        : -1;
      const driver = driverIndex >= 0 ? availableDrivers.splice(driverIndex, 1)[0] : null;
      groups.push({
        entity: this.routePlanGroups.create({
          routePlanId,
          groupIndex: index + 1,
          label: vehicle
            ? `${vehicle.licensePlate || vehicle.make} Run ${index + 1}`
            : `Unassigned Group ${index + 1}`,
          vehicleId: vehicle?.id || null,
          driverId: driver?.id || null,
          totalDistanceKm: 0,
          totalDurationMinutes: 0,
          serviceTimeMinutes: 0,
          totalWeightKg: 0,
          totalVolumeM3: 0,
          warnings: [],
        }),
        bundles: [],
        weight: 0,
        volume: 0,
        minutes: 0,
      });
    }
    return groups;
  }

  private allocateBundlesToGroups(
    bundles: PlannedJobBundle[],
    groups: DraftGroupAllocation[],
    availableVehicles: Vehicle[],
    drivers: Driver[],
  ) {
    const unassigned: Array<{ jobId: string; reason: string }> = [];
    const driverById = new Map(drivers.map((driver) => [driver.id, driver]));

    for (const bundle of bundles) {
      let target = groups[0];
      let chosen = false;
      for (const candidate of groups) {
        const vehicle = availableVehicles.find(
          (item) => item.id === candidate.entity.vehicleId,
        );
        const capacity = vehicle
          ? this.capacityForVehicle(vehicle)
          : { maxWeight: 999999, maxVolume: 999999, maxShiftMinutes: 480 };
        const totalMinutes =
          candidate.minutes + bundle.serviceMinutes + bundle.stops.length * 12;
        const driver = candidate.entity.driverId
          ? driverById.get(candidate.entity.driverId) || null
          : null;
        const fit = vehicle
          ? evaluateVehicleLoadFit({
              vehicle,
              driver,
              jobs: [...candidate.bundles.map((item) => item.job), bundle.job],
            })
          : null;
        if (
          candidate.weight + bundle.weight <= capacity.maxWeight &&
          candidate.volume + bundle.volume <= capacity.maxVolume &&
          totalMinutes <= capacity.maxShiftMinutes &&
          (fit?.fits ?? true)
        ) {
          target = candidate;
          chosen = true;
          break;
        }
      }
      if (!chosen && availableVehicles.length) {
        unassigned.push({
          jobId: bundle.job.id,
          reason: 'capacity or shift constraints exceeded',
        });
        continue;
      }
      target.bundles.push(bundle);
      target.weight += bundle.weight;
      target.volume += bundle.volume;
      target.minutes += bundle.serviceMinutes + bundle.stops.length * 12;
    }

    return { groups, unassigned };
  }

  private async saveDraftGroups(
    groups: DraftGroupAllocation[],
    availableVehicles: Vehicle[],
    drivers: Driver[],
  ): Promise<RoutePlanGroup[]> {
    return this.routePlanGroups.save(
      groups.map((group) => ({
        ...group.entity,
        totalWeightKg: Number(group.weight.toFixed(2)),
        totalVolumeM3: Number(group.volume.toFixed(2)),
        serviceTimeMinutes: group.bundles.reduce(
          (sum, bundle) => sum + bundle.serviceMinutes,
          0,
        ),
        totalDurationMinutes: toWholeMinutes(group.minutes),
        totalDistanceKm: Number((group.minutes * 0.85).toFixed(2)),
        warnings: this.buildGroupFleetWarnings(group, availableVehicles, drivers),
      })),
    );
  }

  private buildGroupFleetWarnings(
    group: DraftGroupAllocation,
    availableVehicles: Vehicle[],
    drivers: Driver[],
  ) {
    if (!group.entity.vehicleId) return ['No vehicle assigned'];
    const vehicle = availableVehicles.find(
      (candidate) => candidate.id === group.entity.vehicleId,
    );
    if (!vehicle) return ['Assigned vehicle is unavailable'];
    const driver = group.entity.driverId
      ? drivers.find((candidate) => candidate.id === group.entity.driverId) || null
      : null;
    const fit = evaluateVehicleLoadFit({
      vehicle,
      driver,
      jobs: group.bundles.map((bundle) => bundle.job),
    });
    if (!fit.fits) {
      throw new Error(
        fit.blockers[0]?.message ||
          `Planner assigned incompatible work to ${group.entity.label || vehicle.licensePlate}.`,
      );
    }
    return fit.warnings.map((warning) => `Vehicle rule: ${warning.message}`);
  }

  private resolveStopSequence(
    preferred: number | null | undefined,
    usedSequences: Set<number>,
    fallback: number,
  ) {
    let candidate =
      Number.isInteger(preferred) && Number(preferred) > 0
        ? Number(preferred)
        : fallback;
    while (usedSequences.has(candidate)) {
      candidate += 1;
    }
    usedSequences.add(candidate);
    return candidate;
  }

  private buildDraftPlanStops(
    routePlanId: string,
    savedGroups: RoutePlanGroup[],
    sourceGroups: DraftGroupAllocation[],
    lockedStops: Map<string, RoutePlanStop>,
  ): RoutePlanStop[] {
    const planStops: RoutePlanStop[] = [];
    savedGroups.forEach((group, groupIndex) => {
      const source = sourceGroups[groupIndex];
      let sequence = 1;
      const usedSequences = new Set<number>();
      for (const bundle of source.bundles) {
        for (const stop of bundle.stops) {
          const locked = lockedStops.get(stop.id);
          const stopSequence = this.resolveStopSequence(
            locked?.stopSequence,
            usedSequences,
            sequence,
          );
          planStops.push(
            this.routePlanStops.create({
              routePlanId,
              routePlanGroupId: group.id,
              jobId: bundle.job.id,
              jobStopId: stop.id,
              stopSequence,
              isLocked: Boolean(locked?.isLocked),
              plannedArrival: stop.timeWindowStart || bundle.job.timeWindowStart,
              plannedDeparture: stop.timeWindowEnd || bundle.job.timeWindowEnd,
              metadata: {
                stopType: stop.stopType,
                address: stop.address,
              },
            }),
          );
          sequence = Math.max(sequence + 1, stopSequence + 1);
        }
      }
    });
    return planStops;
  }

  private async clearPlan(planId: string) {
    await this.routePlanStops.delete({ routePlanId: planId });
    await this.routePlanGroups.delete({ routePlanId: planId });
  }

  private async getLockedStops(planId: string) {
    const locked = await this.routePlanStops.find({ where: { routePlanId: planId, isLocked: true } });
    return new Map(locked.map((stop) => [stop.jobStopId, stop]));
  }

  private routePlanPublishDecisions(
    routePlan: RoutePlan,
  ): RoutePlanPublishDecision[] {
    return Array.isArray(routePlan.publishDecisions)
      ? routePlan.publishDecisions
      : [];
  }

  private findAcceptedPublishDecision(
    blocker: PublishBlocker,
    routePlan: RoutePlan,
  ) {
    if (!blocker.canAcceptRisk) return undefined;
    return this.routePlanPublishDecisions(routePlan).find((decision) => {
      if (decision.decision !== 'accepted_risk') return false;
      if (decision.blockerCode !== blocker.code) return false;
      if (blocker.jobId && decision.jobId !== blocker.jobId) return false;
      if (blocker.groupId && decision.groupId !== blocker.groupId) return false;
      if (
        blocker.warningIndex !== undefined &&
        decision.warningIndex !== blocker.warningIndex
      ) {
        return false;
      }
      return true;
    });
  }

  private applyPublishDecisions(
    routePlan: RoutePlan,
    blockers: PublishBlocker[],
  ) {
    return blockers.map((blocker) => ({
      ...blocker,
      acceptedDecision: this.findAcceptedPublishDecision(blocker, routePlan),
    }));
  }

  private formatWarning(warning: string | Record<string, unknown>) {
    if (typeof warning === 'string') return warning;
    if (typeof warning.message === 'string') return warning.message;
    if (typeof warning.type === 'string') return warning.type;
    return 'Planner warning requires review';
  }

  private async buildPublishReadiness(routePlanId: string, actor?: Actor) {
    const { routePlan, groups, stops } = await this.getRoutePlan(routePlanId, actor);
    const plannedJobIds = Array.from(new Set(stops.map((stop) => stop.jobId)));
    const plannedJobs = plannedJobIds.length
      ? await this.jobs.find({
          where: { organizationId: routePlan.organizationId, id: In(plannedJobIds) },
        })
      : [];
    const plannedJobById = new Map(plannedJobs.map((job) => [job.id, job]));
    const blockers: PublishBlocker[] = [];

    if (!groups.length || !stops.length) {
      blockers.push({
        code: 'EMPTY_PLAN',
        message: 'Generate a route plan with at least one lane and stop before publishing.',
        severity: 'blocking',
        canAcceptRisk: false,
      });
    }

    const groupIds = new Set(groups.map((group) => group.id));
    const orphanedGroupIds = Array.from(
      new Set(
        stops
          .map((stop) => stop.routePlanGroupId)
          .filter((groupId) => !groupIds.has(groupId)),
      ),
    );
    if (orphanedGroupIds.length) {
      blockers.push({
        code: 'ORPHANED_PLAN_STOPS',
        message:
          'Route plan stops reference lanes that no longer exist. Regenerate the plan before publishing.',
        severity: 'blocking',
        canAcceptRisk: false,
      });
    }

    for (const group of groups) {
      const groupStops = stops.filter((stop) => stop.routePlanGroupId === group.id);
      if (!groupStops.length) continue;
      if (!group.vehicleId) {
        blockers.push({
          code: 'MISSING_VEHICLE',
          message: `${group.label || 'Route'} needs a vehicle before publish.`,
          severity: 'blocking',
          canAcceptRisk: false,
          groupId: group.id,
        });
      }
      if (!group.driverId) {
        blockers.push({
          code: 'MISSING_DRIVER',
          message: `${group.label || 'Route'} needs a driver before publish.`,
          severity: 'blocking',
          canAcceptRisk: false,
          groupId: group.id,
        });
      }
    }

    routePlan.warnings?.forEach((warning, index) => {
      if (
        isObjectRecord(warning) &&
        (warning.type === 'OPTIMIZER_OBJECTIVE' ||
          warning.type === 'OPTIMIZER_PROVENANCE')
      ) {
        return;
      }
      if (
        isObjectRecord(warning) &&
        (warning.type === 'OPTIMIZER_DEGRADED_MATRIX' ||
          warning.type === 'OPTIMIZER_FALLBACK')
      ) {
        blockers.push({
          code: 'OPTIMIZER_INPUT_DEGRADED',
          message: this.formatWarning(warning),
          severity: 'blocking',
          canAcceptRisk: false,
          warningIndex: index,
        });
        return;
      }
      blockers.push({
        code: 'ROUTE_PLAN_WARNING',
        message: this.formatWarning(warning),
        severity: 'blocking',
        canAcceptRisk: true,
        warningIndex: index,
      });
    });

    groups.forEach((group) => {
      if (!stops.some((stop) => stop.routePlanGroupId === group.id)) return;
      (group.warnings || []).forEach((warning, index) => {
        blockers.push({
          code: 'ROUTE_GROUP_WARNING',
          message: `${group.label || 'Route'}: ${this.formatWarning(warning)}`,
          severity: 'blocking',
          canAcceptRisk: true,
          groupId: group.id,
          warningIndex: index,
        });
      });
    });

    for (const jobId of plannedJobIds) {
      const job = plannedJobById.get(jobId);
      if (!job) {
        blockers.push({
          code: 'JOB_NOT_FOUND',
          message: `Planned job ${jobId} is no longer available.`,
          severity: 'blocking',
          canAcceptRisk: false,
          jobId,
        });
        continue;
      }
      const readiness = evaluateJobRoutingReadiness({
        deliveryAddress: job.deliveryAddress,
        timeWindowStart: job.timeWindowStart,
        timeWindowEnd: job.timeWindowEnd,
        estimatedDuration: job.estimatedDuration,
        weight: job.weight,
        volume: job.volume,
        quantity: job.quantity,
        routingRequirements: job.routingRequirements,
      });
      if (readiness.status === 'routable') continue;
      const code =
        readiness.status === 'missing_data'
          ? 'JOB_MISSING_DATA'
          : readiness.status === 'capacity_risk'
            ? 'JOB_CAPACITY_RISK'
            : readiness.status === 'appointment_risk'
              ? 'JOB_APPOINTMENT_RISK'
              : 'JOB_ACCESS_RISK';
      blockers.push({
        code,
        message: `${job.customerName || job.id}: ${readiness.summary}`,
        severity: 'blocking',
        canAcceptRisk: readiness.status !== 'missing_data',
        jobId: job.id,
      });
    }

    const plannedJobIdSet = new Set(plannedJobIds);
    const sameOrgJobs = await this.jobs.find({
      where: { organizationId: routePlan.organizationId },
      order: { createdAt: 'ASC' },
    });
    sameOrgJobs
      .filter((job) => !plannedJobIdSet.has(job.id))
      .filter((job) => ![JobStatus.COMPLETED, JobStatus.CANCELLED, JobStatus.ARCHIVED].includes(job.status))
      .filter((job) => !job.assignedRouteId)
      .forEach((job) => {
        blockers.push({
          code: 'UNASSIGNED_JOB',
          message: `${job.customerName || job.id} is not assigned to the route plan.`,
          severity: 'blocking',
          canAcceptRisk: false,
          jobId: job.id,
        });
      });

    const blockersWithDecisions = this.applyPublishDecisions(routePlan, blockers);
    const blockingBlockers = blockersWithDecisions.filter(
      (blocker) => !blocker.acceptedDecision,
    );

    return {
      ok: true,
      routePlanId,
      ready: blockingBlockers.length === 0,
      blockers: blockersWithDecisions,
      blockingBlockers,
      decisions: this.routePlanPublishDecisions(routePlan),
      summary: {
        blockerCount: blockersWithDecisions.length,
        blockingCount: blockingBlockers.length,
        acceptedRiskCount: blockersWithDecisions.filter(
          (blocker) => blocker.acceptedDecision,
        ).length,
      },
    };
  }

  async getPublishReadiness(routePlanId: string, actor?: Actor) {
    return this.buildPublishReadiness(routePlanId, actor);
  }

  async acceptPublishRisk(
    routePlanId: string,
    dto: AcceptPublishRiskDto,
    actor?: Actor,
  ) {
    const { routePlan } = await this.getRoutePlan(routePlanId, actor);
    const reason = String(dto.reason || '').trim();
    if (reason.length < 8) {
      throw new BadRequestException('Accepted risk reason is required.');
    }
    const decision: RoutePlanPublishDecision = {
      id: `decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      decision: 'accepted_risk',
      blockerCode: dto.blockerCode,
      reason,
      actorId: actor?.userId || null,
      jobId: dto.jobId || null,
      groupId: dto.groupId || null,
      warningIndex: dto.warningIndex ?? null,
      createdAt: new Date().toISOString(),
    };
    routePlan.publishDecisions = [
      ...this.routePlanPublishDecisions(routePlan).filter(
        (item) =>
          !(
            item.blockerCode === decision.blockerCode &&
            (decision.jobId ? item.jobId === decision.jobId : true) &&
            (decision.groupId ? item.groupId === decision.groupId : true) &&
            (decision.warningIndex !== null
              ? item.warningIndex === decision.warningIndex
              : true)
          ),
      ),
      decision,
    ];
    await this.routePlans.save(routePlan);
    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'route_plan',
      entityId: routePlanId,
      action: 'route-plan.publish-risk.accepted',
      source: 'user',
      newValue: decision as unknown as Record<string, unknown>,
      metadata: { organizationId: routePlan.organizationId },
    });
    return this.buildPublishReadiness(routePlanId, actor);
  }

  async getPlannerView(serviceDate: string, actor?: Actor) {
    const organizationId = this.requireOrganizationId(actor);
    const plan = await this.routePlans.findOne({
      where: { organizationId, serviceDate, status: In(ACTIVE_ROUTE_PLAN_STATUSES) },
      order: { updatedAt: 'DESC' },
    });
    if (plan) {
      plan.objective = this.resolveOptimizationObjective(plan.objective);
    }
    const groups = plan ? await this.routePlanGroups.find({ where: { routePlanId: plan.id }, order: { groupIndex: 'ASC' } }) : [];
    const stops = plan ? await this.routePlanStops.find({ where: { routePlanId: plan.id }, order: { stopSequence: 'ASC' } }) : [];
    const jobs = await this.jobs.find({
      where: { organizationId, archivedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    const unassignedJobs = jobs.filter((job) => !groups.length || !stops.some((stop) => stop.jobId === job.id));
    return { ok: true, serviceDate, plan, groups, stops, unassignedJobs };
  }

  async generateDraft(dto: GenerateRoutePlanDto, actor?: Actor) {
    const organizationId = this.requireOrganizationId(actor);
    const depot = await this.ensureDepot(organizationId, dto.depotId);
    const objective = this.resolveOptimizationObjective(dto.objective);
    const reusablePlans = await this.routePlans.find({
      where: {
        organizationId,
        serviceDate: dto.serviceDate,
        status: In(['DRAFT', 'READY']),
      },
      order: { updatedAt: 'DESC' },
    });
    let plan = reusablePlans[0] || null;
    const lockedStops = plan ? await this.getLockedStops(plan.id) : new Map<string, RoutePlanStop>();
    const previousGroups = plan
      ? await this.routePlanGroups.find({
          where: { routePlanId: plan.id },
          order: { groupIndex: 'ASC' },
        })
      : [];
    const supersededPlanUpdates = reusablePlans
      .filter((candidate) => candidate.id !== plan?.id)
      .map((candidate) => ({ ...candidate, status: 'ARCHIVED' as const }));
    if (supersededPlanUpdates.length) {
      await this.routePlans.save(supersededPlanUpdates);
    }
    if (!plan) {
      plan = await this.routePlans.save(this.routePlans.create({
        organizationId,
        serviceDate: dto.serviceDate,
        depotId: depot.id,
        objective,
        status: 'DRAFT',
        metrics: {},
        warnings: [],
        createdByUserId: actor?.userId,
      }));
    } else {
      await this.clearPlan(plan.id);
      plan.depotId = depot.id;
      plan.objective = objective;
      plan.status = 'DRAFT';
      plan = await this.routePlans.save(plan);
    }

    const jobs = await this.jobs.find({
      where: {
        organizationId,
        ...(dto.jobIds?.length ? { id: In(dto.jobIds) } : {}),
      },
      order: { createdAt: 'ASC' },
    });
    const candidateJobs = jobs.filter((job) => ![JobStatus.COMPLETED, JobStatus.CANCELLED, JobStatus.ARCHIVED].includes(job.status));
    const vehicles = await this.vehicles.find({
      where: { organizationId, ...(dto.vehicleIds?.length ? { id: In(dto.vehicleIds) } : {}) },
      order: { createdAt: 'ASC' },
    });
    const availableVehicles = vehicles.filter((vehicle) => String(vehicle.status || '').toLowerCase() !== 'maintenance');
    const drivers = await this.drivers.find({
      where: { organizationId },
      order: { createdAt: 'ASC' },
    });
    const stopsByJob = await this.ensureJobStopsForJobs(candidateJobs, organizationId);
    const preliminaryBundles = this.buildJobBundles(
      candidateJobs,
      stopsByJob,
      new Map(),
    );
    const lockedVehicleByJobId = this.buildLockedVehicleByJobId(
      lockedStops,
      previousGroups,
      preliminaryBundles,
    );
    const bundles = this.buildJobBundles(
      candidateJobs,
      stopsByJob,
      lockedVehicleByJobId,
    );

    const warnings: Array<string | Record<string, unknown>> = [];
    if (!availableVehicles.length) {
      warnings.push('No vehicles available for planning; draft contains only unassigned work.');
    }

    let computed: DraftPlanComputation;
    if (availableVehicles.length && bundles.length) {
      try {
        computed = await this.computeSolverDraft({
          plan,
          depot,
          objective,
          bundles,
          availableVehicles,
          drivers,
          lockedStops,
        });
      } catch (error) {
        this.logger.warn(
          `Planner optimizer unavailable, falling back to greedy allocator: ${error instanceof Error ? error.message : String(error)}`,
        );
        warnings.push({
          type: 'OPTIMIZER_FALLBACK',
          message:
            error instanceof Error
              ? error.message
              : 'Planner optimizer unavailable; used greedy fallback.',
        });
        computed = await this.computeFallbackDraft({
          plan,
          bundles,
          availableVehicles,
          drivers,
          lockedStops,
          baseWarnings: warnings,
        });
      }
    } else {
      computed = await this.computeFallbackDraft({
        plan,
        bundles,
        availableVehicles,
        drivers,
        lockedStops,
        baseWarnings: warnings,
      });
    }

    await this.routePlanStops.save(
      computed.stops.sort((a, b) => a.stopSequence - b.stopSequence),
    );

    plan.metrics = computed.metrics;
    plan.warnings = computed.warnings;
    plan.status = 'READY';
    await this.routePlans.save(plan);

    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'route_plan',
      entityId: plan.id,
      action: 'route-plan.generated',
      source: 'user',
      newValue: { serviceDate: dto.serviceDate, objective: plan.objective },
      metadata: { organizationId },
    });

    return this.getRoutePlan(plan.id, actor);
  }

  async reoptimize(routePlanId: string, actor?: Actor) {
    const { routePlan: plan } = await this.getRoutePlan(routePlanId, actor);
    const existingStops = await this.routePlanStops.find({ where: { routePlanId } });
    const vehicleIds = (await this.routePlanGroups.find({ where: { routePlanId } })).map((group) => group.vehicleId).filter(Boolean) as string[];
    const jobIds = Array.from(new Set(existingStops.map((stop) => stop.jobId)));
    return this.generateDraft({
      serviceDate: plan.serviceDate,
      depotId: plan.depotId || undefined,
      objective: this.resolveOptimizationObjective(plan.objective),
      vehicleIds,
      jobIds,
    }, actor);
  }

  async getRoutePlan(routePlanId: string, actor?: Actor) {
    const organizationId = this.requireOrganizationId(actor);
    const plan = await this.routePlans.findOne({ where: { id: routePlanId, organizationId } });
    if (!plan) throw new NotFoundException(`Route plan not found: ${routePlanId}`);
    plan.objective = this.resolveOptimizationObjective(plan.objective);
    const groups = await this.routePlanGroups.find({ where: { routePlanId }, order: { groupIndex: 'ASC' } });
    const stops = await this.routePlanStops.find({ where: { routePlanId }, order: { routePlanGroupId: 'ASC', stopSequence: 'ASC' } });
    return { ok: true, routePlan: plan, groups, stops };
  }

  async getDriverFamiliarity(routePlanId: string, actor?: Actor) {
    const organizationId = this.requireOrganizationId(actor);
    const { routePlan, groups, stops } = await this.getRoutePlan(routePlanId, actor);
    const serviceDate = new Date(`${routePlan.serviceDate}T23:59:59.999Z`);
    const historyStart = new Date(serviceDate);
    historyStart.setUTCDate(historyStart.getUTCDate() - DRIVER_FAMILIARITY_LOOKBACK_DAYS);

    const [completedRouteRows, activeDrivers] = await Promise.all([
      this.routes.find({
        where: { organizationId, status: RouteStatus.COMPLETED },
        order: { completedAt: 'DESC' },
        take: DRIVER_FAMILIARITY_ROUTE_LIMIT,
      }),
      this.drivers.find({
        where: { organizationId, employmentStatus: 'active' },
        order: { lastName: 'ASC', firstName: 'ASC' },
      }),
    ]);
    const completedRoutes = completedRouteRows.filter((route) => {
      if (!route.driverId || !route.completedAt) return false;
      const completedAt = new Date(route.completedAt);
      return completedAt >= historyStart && completedAt <= serviceDate;
    });
    const currentJobStopIds = Array.from(new Set(stops.map((stop) => stop.jobStopId).filter(Boolean)));
    const historicalRouteIds = completedRoutes.map((route) => route.id);
    const historicalRunStops = historicalRouteIds.length
      ? await this.routeRunStops.find({
          where: { routeId: In(historicalRouteIds), status: 'SERVICED' },
          order: { actualDeparture: 'DESC' },
        })
      : [];
    const allJobStopIds = Array.from(new Set([
      ...currentJobStopIds,
      ...historicalRunStops.map((stop) => stop.jobStopId).filter(Boolean),
    ]));
    const locatedJobStops = allJobStopIds.length
      ? await this.jobStops.find({ where: { id: In(allJobStopIds), organizationId } })
      : [];
    const locationByJobStopId = new Map<string, FamiliarityLocation>();
    locatedJobStops.forEach((stop) => {
      const lat = Number(stop.location?.lat);
      const lng = Number(stop.location?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        locationByJobStopId.set(stop.id, { lat, lng });
      }
    });
    const routeById = new Map(completedRoutes.map((route) => [route.id, route]));
    const visits = historicalRunStops.flatMap((stop): DriverHistoricalVisit[] => {
      const route = routeById.get(stop.routeId);
      const location = locationByJobStopId.get(stop.jobStopId);
      if (!route?.driverId || !route.completedAt || !location) return [];
      return [{
        driverId: route.driverId,
        routeId: route.id,
        location,
        completedAt: new Date(route.completedAt),
      }];
    });

    const recommendations = groups.map((group) =>
      calculateRouteDriverFamiliarity({
        groupId: group.id,
        targetLocations: stops
          .filter((stop) => stop.routePlanGroupId === group.id)
          .flatMap((stop) => {
            const location = locationByJobStopId.get(stop.jobStopId);
            return location ? [location] : [];
          }),
        driverIds: activeDrivers.map((driver) => driver.id),
        visits,
      }),
    );

    return {
      ok: true,
      source: 'completed_route_history' as const,
      routePlanId,
      serviceDate: routePlan.serviceDate,
      lookbackDays: DRIVER_FAMILIARITY_LOOKBACK_DAYS,
      radiusKm: DRIVER_FAMILIARITY_RADIUS_KM,
      thresholds: {
        minimumCompletedRoutes: DRIVER_FAMILIARITY_MIN_ROUTES,
        minimumServicedStops: DRIVER_FAMILIARITY_MIN_STOPS,
      },
      history: {
        completedRouteCount: completedRoutes.length,
        servicedLocatedStopCount: visits.length,
        routeLimitReached: completedRoutes.length >= DRIVER_FAMILIARITY_ROUTE_LIMIT,
      },
      recommendations,
    };
  }

  async updateGroup(routePlanId: string, groupId: string, dto: UpdateRoutePlanGroupDto, actor?: Actor) {
    const view = await this.getRoutePlan(routePlanId, actor);
    const group = view.groups.find((item) => item.id === groupId);
    if (!group) throw new NotFoundException(`Route plan group not found: ${groupId}`);
    const nextDriverId = dto.driverId !== undefined ? dto.driverId || null : group.driverId;
    const nextVehicleId = dto.vehicleId !== undefined ? dto.vehicleId || null : group.vehicleId;
    const groupJobIds = Array.from(
      new Set(
        view.stops
          .filter((stop) => stop.routePlanGroupId === groupId)
          .map((stop) => stop.jobId),
      ),
    );
    if (groupJobIds.length) {
      if (!nextVehicleId) {
        throw new BadRequestException({
          code: 'ROUTE_GROUP_VEHICLE_REQUIRED',
          message: 'A route containing work must have a vehicle assigned.',
        });
      }
      const [vehicle, driver, routeJobs] = await Promise.all([
        this.vehicles.findOne({
          where: { id: nextVehicleId, organizationId: view.routePlan.organizationId },
        }),
        nextDriverId
          ? this.drivers.findOne({
              where: { id: nextDriverId, organizationId: view.routePlan.organizationId },
            })
          : Promise.resolve(null),
        this.jobs.find({
          where: { id: In(groupJobIds), organizationId: view.routePlan.organizationId },
        }),
      ]);
      if (!vehicle) {
        throw new BadRequestException({
          code: 'ROUTE_GROUP_VEHICLE_UNAVAILABLE',
          message: 'The selected vehicle is unavailable to this organization.',
        });
      }
      if (nextDriverId && !driver) {
        throw new BadRequestException({
          code: 'ROUTE_GROUP_DRIVER_UNAVAILABLE',
          message: 'The selected driver is unavailable to this organization.',
        });
      }
      const fit = evaluateVehicleLoadFit({ vehicle, driver, jobs: routeJobs });
      if (!fit.fits) {
        throw new BadRequestException({
          code: 'ROUTE_GROUP_FLEET_CONSTRAINT',
          message: fit.blockers[0]?.message || 'The driver, vehicle, and route work are incompatible.',
          blockers: fit.blockers,
          fit,
        });
      }
      group.warnings = [
        ...(group.warnings || []).filter(
          (warning) => !String(warning).startsWith('Vehicle rule:'),
        ),
        ...fit.warnings.map((warning) => `Vehicle rule: ${warning.message}`),
      ];
    }
    group.driverId = nextDriverId;
    group.vehicleId = nextVehicleId;
    await this.routePlanGroups.save(group);
    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'route_plan_group',
      entityId: groupId,
      action: 'route-plan.group.updated',
      source: 'user',
      newValue: dto as Record<string, unknown>,
      metadata: { organizationId: view.routePlan.organizationId },
    });
    return this.getRoutePlan(routePlanId, actor);
  }

  async updateStop(routePlanId: string, stopId: string, dto: UpdateRoutePlanStopDto, actor?: Actor) {
    await this.getRoutePlan(routePlanId, actor);
    const stop = await this.routePlanStops.findOne({ where: { id: stopId, routePlanId } });
    if (!stop) throw new NotFoundException(`Route plan stop not found: ${stopId}`);
    const shouldMoveStop = dto.targetGroupId !== undefined || dto.targetSequence !== undefined;
    if (shouldMoveStop) {
      if (dto.isLocked !== undefined) {
        throw new BadRequestException({
          code: 'ROUTE_STOP_MOVE_LOCK_CHANGE_CONFLICT',
          message: 'Change stop protection separately before moving the stop.',
        });
      }
      return this.batchMoveStops(
        routePlanId,
        {
          stopIds: [stopId],
          targetGroupId: dto.targetGroupId || stop.routePlanGroupId,
          targetSequence: Math.max(
            1,
            dto.targetSequence || stop.stopSequence || 1,
          ),
        },
        actor,
      );
    }

    if (dto.isLocked !== undefined) stop.isLocked = dto.isLocked;
    await this.routePlanStops.save(stop);
    return this.getRoutePlan(routePlanId, actor);
  }

  async batchMoveStops(
    routePlanId: string,
    dto: BatchMoveRoutePlanStopsDto,
    actor?: Actor,
  ) {
    const organizationId = this.requireOrganizationId(actor);
    const result = await this.dataSource.transaction(async (manager) => {
      const routePlans = manager.getRepository(RoutePlan);
      const routePlanGroups = manager.getRepository(RoutePlanGroup);
      const routePlanStops = manager.getRepository(RoutePlanStop);
      const jobs = manager.getRepository(Job);
      const jobStops = manager.getRepository(JobStop);
      const vehicles = manager.getRepository(Vehicle);
      const drivers = manager.getRepository(Driver);

      const routePlan = await routePlans.findOne({
        where: { id: routePlanId, organizationId },
      });
      if (!routePlan) {
        throw new NotFoundException(`Route plan not found: ${routePlanId}`);
      }
      if (!['DRAFT', 'READY'].includes(routePlan.status)) {
        throw new BadRequestException({
          code: 'ROUTE_BATCH_MOVE_PLAN_LOCKED',
          message: 'Only draft or ready route plans can be batch edited.',
        });
      }

      const groups = await routePlanGroups.find({
        where: { routePlanId },
        order: { groupIndex: 'ASC' },
      });
      const targetGroup = groups.find((group) => group.id === dto.targetGroupId);
      if (!targetGroup) {
        throw new NotFoundException(
          `Route plan group not found: ${dto.targetGroupId}`,
        );
      }

      const allPlanStops = await routePlanStops.find({
        where: { routePlanId },
        order: { routePlanGroupId: 'ASC', stopSequence: 'ASC' },
      });
      const requestedStopIds = new Set(dto.stopIds);
      const requestedStops = allPlanStops.filter((stop) =>
        requestedStopIds.has(stop.id),
      );
      if (requestedStops.length !== requestedStopIds.size) {
        throw new BadRequestException({
          code: 'ROUTE_BATCH_MOVE_NOT_FOUND',
          message: 'One or more selected stops are no longer in this route plan.',
        });
      }

      const movingJobIds = Array.from(
        new Set(requestedStops.map((stop) => stop.jobId)),
      );
      const movingStops = allPlanStops.filter((stop) =>
        movingJobIds.includes(stop.jobId),
      );
      const protectedStops = movingStops.filter((stop) => stop.isLocked);
      if (protectedStops.length) {
        throw new BadRequestException({
          code: 'ROUTE_BATCH_MOVE_PROTECTED',
          message: 'Protected stops cannot be batch moved. Unlock them first.',
          stopIds: protectedStops.map((stop) => stop.id),
        });
      }

      const sourceGroupByJobId = new Map<string, string>();
      for (const jobId of movingJobIds) {
        const sourceGroupIds = Array.from(
          new Set(
            movingStops
              .filter((stop) => stop.jobId === jobId)
              .map((stop) => stop.routePlanGroupId),
          ),
        );
        if (sourceGroupIds.length !== 1) {
          throw new BadRequestException({
            code: 'ROUTE_BATCH_MOVE_SPLIT_JOB',
            message:
              'A selected job is already split across routes. Reoptimize before moving it.',
            jobId,
          });
        }
        sourceGroupByJobId.set(jobId, sourceGroupIds[0]);
      }

      const movingJobs = await jobs.find({
        where: { id: In(movingJobIds), organizationId },
      });
      if (movingJobs.length !== movingJobIds.length) {
        throw new BadRequestException({
          code: 'ROUTE_BATCH_MOVE_JOB_NOT_FOUND',
          message: 'One or more selected jobs are unavailable to this organization.',
        });
      }

      const groupIndexById = new Map(
        groups.map((group) => [group.id, group.groupIndex]),
      );
      const orderedMovingStops = [...movingStops].sort((left, right) => {
        const positionRank = (jobId: string) => {
          const position = movingJobs.find((job) => job.id === jobId)
            ?.routingRequirements?.sequence?.position;
          return position === 'first' ? -1 : position === 'last' ? 1 : 0;
        };
        const rankDifference = positionRank(left.jobId) - positionRank(right.jobId);
        if (rankDifference) return rankDifference;
        const groupDifference =
          (groupIndexById.get(left.routePlanGroupId) || 0) -
          (groupIndexById.get(right.routePlanGroupId) || 0);
        return groupDifference || left.stopSequence - right.stopSequence;
      });
      const movingStopIds = new Set(movingStops.map((stop) => stop.id));
      const targetStopsBeforeMove = allPlanStops
        .filter(
          (stop) =>
            stop.routePlanGroupId === targetGroup.id && !movingStopIds.has(stop.id),
        )
        .sort((left, right) => left.stopSequence - right.stopSequence);
      const existingTargetJobIds = Array.from(
        new Set(targetStopsBeforeMove.map((stop) => stop.jobId)),
      );
      const existingTargetJobs = existingTargetJobIds.length
        ? await jobs.find({ where: { id: In(existingTargetJobIds), organizationId } })
        : [];
      const existingTargetJobById = new Map(
        existingTargetJobs.map((job) => [job.id, job]),
      );
      const existingLastStopIndex = targetStopsBeforeMove.findIndex(
        (stop) =>
          existingTargetJobById.get(stop.jobId)?.routingRequirements?.sequence?.position === 'last',
      );
      const requestedTargetSequence = Math.min(
        Math.max(1, dto.targetSequence || targetStopsBeforeMove.length + 1),
        targetStopsBeforeMove.length + 1,
      );
      const movingHasFirst = movingJobs.some(
        (job) => job.routingRequirements?.sequence?.position === 'first',
      );
      const movingHasLast = movingJobs.some(
        (job) => job.routingRequirements?.sequence?.position === 'last',
      );
      const targetSequence = movingHasFirst
        ? 1
        : movingHasLast
          ? targetStopsBeforeMove.length + 1
          : existingLastStopIndex >= 0
            ? Math.min(requestedTargetSequence, existingLastStopIndex + 1)
            : requestedTargetSequence;
      const simulatedTargetStops = [...targetStopsBeforeMove];
      simulatedTargetStops.splice(targetSequence - 1, 0, ...orderedMovingStops);
      const targetRouteJobs = [...existingTargetJobs, ...movingJobs].filter(
        (job, index, all) => all.findIndex((candidate) => candidate.id === job.id) === index,
      );
      const sequenceIssues = this.sequenceConstraintIssues(
        simulatedTargetStops.map((stop) => stop.jobId),
        targetRouteJobs,
      );
      if (sequenceIssues.length) {
        throw new BadRequestException({
          code: 'ROUTE_BATCH_MOVE_SEQUENCE_CONSTRAINT',
          message: sequenceIssues[0].message,
          blockers: sequenceIssues,
        });
      }
      if (targetRouteJobs.length) {
        if (!targetGroup.vehicleId) {
          throw new BadRequestException({
            code: 'ROUTE_BATCH_MOVE_CONSTRAINT',
            message: 'Assign a vehicle before moving work into this route.',
            constraints: ['vehicle'],
          });
        }
        const [targetVehicle, targetDriver] = await Promise.all([
          vehicles.findOne({
            where: { id: targetGroup.vehicleId, organizationId },
          }),
          targetGroup.driverId
            ? drivers.findOne({
                where: { id: targetGroup.driverId, organizationId },
              })
            : Promise.resolve(null),
        ]);
        if (!targetVehicle) {
          throw new BadRequestException({
            code: 'ROUTE_BATCH_MOVE_CONSTRAINT',
            message: 'The target route vehicle is unavailable.',
            constraints: ['vehicle'],
          });
        }
        const fit = evaluateVehicleLoadFit({
          vehicle: targetVehicle,
          driver: targetDriver,
          jobs: targetRouteJobs,
        });
        if (!fit.fits) {
          throw new BadRequestException({
            code: 'ROUTE_BATCH_MOVE_FLEET_CONSTRAINT',
            message: fit.blockers[0]?.message || 'The moved work does not fit the target route.',
            blockers: fit.blockers,
            fit,
          });
        }
      }
      for (const sourceGroupId of new Set(sourceGroupByJobId.values())) {
        if (sourceGroupId === targetGroup.id) continue;
        const remainingSourceStops = allPlanStops
          .filter(
            (stop) =>
              stop.routePlanGroupId === sourceGroupId && !movingStopIds.has(stop.id),
          )
          .sort((left, right) => left.stopSequence - right.stopSequence);
        const remainingJobIds = Array.from(
          new Set(remainingSourceStops.map((stop) => stop.jobId)),
        );
        const remainingJobs = remainingJobIds.length
          ? await jobs.find({ where: { id: In(remainingJobIds), organizationId } })
          : [];
        const sourceSequenceIssues = this.sequenceConstraintIssues(
          remainingSourceStops.map((stop) => stop.jobId),
          remainingJobs,
        );
        if (sourceSequenceIssues.length) {
          throw new BadRequestException({
            code: 'ROUTE_BATCH_MOVE_SEQUENCE_CONSTRAINT',
            message: sourceSequenceIssues[0].message,
            blockers: sourceSequenceIssues,
          });
        }
      }

      const sourceJobStops = await jobStops.find({
        where: { id: In(movingStops.map((stop) => stop.jobStopId)) },
      });
      const sourceJobStopsById = new Map(
        sourceJobStops.map((stop) => [stop.id, stop]),
      );
      const deltasByGroupId = new Map<
        string,
        { weightKg: number; volumeM3: number; serviceMinutes: number; durationMinutes: number }
      >();
      const ensureDelta = (groupId: string) => {
        const existing = deltasByGroupId.get(groupId);
        if (existing) return existing;
        const created = {
          weightKg: 0,
          volumeM3: 0,
          serviceMinutes: 0,
          durationMinutes: 0,
        };
        deltasByGroupId.set(groupId, created);
        return created;
      };

      for (const job of movingJobs) {
        const sourceGroupId = sourceGroupByJobId.get(job.id);
        if (!sourceGroupId || sourceGroupId === targetGroup.id) continue;
        const jobPlanStops = movingStops.filter((stop) => stop.jobId === job.id);
        const serviceMinutes = jobPlanStops.reduce(
          (sum, stop) =>
            sum +
            toWholeMinutes(
              sourceJobStopsById.get(stop.jobStopId)?.serviceDurationMinutes,
            ),
          0,
        );
        const durationMinutes = serviceMinutes + jobPlanStops.length * 12;
        const demand = this.demandForJob(job);
        const sourceDelta = ensureDelta(sourceGroupId);
        sourceDelta.weightKg -= demand.weightKg;
        sourceDelta.volumeM3 -= demand.volumeM3;
        sourceDelta.serviceMinutes -= serviceMinutes;
        sourceDelta.durationMinutes -= durationMinutes;
        const targetDelta = ensureDelta(targetGroup.id);
        targetDelta.weightKg += demand.weightKg;
        targetDelta.volumeM3 += demand.volumeM3;
        targetDelta.serviceMinutes += serviceMinutes;
        targetDelta.durationMinutes += durationMinutes;
      }

      const targetDelta = ensureDelta(targetGroup.id);
      const projectedTarget = {
        weightKg: Math.max(
          0,
          toNumber(targetGroup.totalWeightKg) + targetDelta.weightKg,
        ),
        volumeM3: Math.max(
          0,
          toNumber(targetGroup.totalVolumeM3) + targetDelta.volumeM3,
        ),
        durationMinutes: Math.max(
          0,
          toWholeMinutes(targetGroup.totalDurationMinutes) +
            targetDelta.durationMinutes,
        ),
      };
      if (targetDelta.durationMinutes > 0) {
        if (!targetGroup.vehicleId) {
          throw new BadRequestException({
            code: 'ROUTE_BATCH_MOVE_CONSTRAINT',
            message: 'Assign a vehicle before moving work into this route.',
            constraints: ['vehicle'],
          });
        }
        const vehicle = await vehicles.findOne({
          where: { id: targetGroup.vehicleId, organizationId },
        });
        if (!vehicle) {
          throw new BadRequestException({
            code: 'ROUTE_BATCH_MOVE_CONSTRAINT',
            message: 'The target route vehicle is unavailable.',
            constraints: ['vehicle'],
          });
        }
        const capacity = this.capacityForVehicle(vehicle);
        const constraints: string[] = [];
        if (projectedTarget.weightKg > capacity.maxWeight) {
          constraints.push('weight');
        }
        if (projectedTarget.volumeM3 > capacity.maxVolume) {
          constraints.push('volume');
        }
        if (projectedTarget.durationMinutes > capacity.maxShiftMinutes) {
          constraints.push('shift');
        }
        if (constraints.length) {
          throw new BadRequestException({
            code: 'ROUTE_BATCH_MOVE_CONSTRAINT',
            message: `Batch move exceeds target route ${constraints.join(', ')} constraints.`,
            constraints,
            projected: {
              weightKg: Number(projectedTarget.weightKg.toFixed(2)),
              volumeM3: Number(projectedTarget.volumeM3.toFixed(2)),
              durationMinutes: projectedTarget.durationMinutes,
            },
            limits: {
              weightKg: capacity.maxWeight,
              volumeM3: capacity.maxVolume,
              durationMinutes: capacity.maxShiftMinutes,
            },
          });
        }
      }

      const originalSourceGroupIds = Array.from(
        new Set(movingStops.map((stop) => stop.routePlanGroupId)),
      );
      const affectedGroupIds = new Set([
        targetGroup.id,
        ...movingStops.map((stop) => stop.routePlanGroupId),
      ]);
      const affectedStops = allPlanStops.filter((stop) =>
        affectedGroupIds.has(stop.routePlanGroupId),
      );
      const temporarySequenceOffset = 100_000;
      affectedStops.forEach((stop, index) => {
        stop.stopSequence = temporarySequenceOffset + index + 1;
      });
      await routePlanStops.save(affectedStops);

      const finalStops: RoutePlanStop[] = [];
      for (const group of groups) {
        if (!affectedGroupIds.has(group.id) || group.id === targetGroup.id) {
          continue;
        }
        const sourceStops = allPlanStops
          .filter(
            (stop) =>
              stop.routePlanGroupId === group.id && !movingStopIds.has(stop.id),
          )
          .sort((left, right) => left.stopSequence - right.stopSequence);
        sourceStops.forEach((stop, index) => {
          stop.stopSequence = index + 1;
          finalStops.push(stop);
        });
      }
      const targetStops = targetStopsBeforeMove;
      targetStops.splice(targetSequence - 1, 0, ...orderedMovingStops);
      targetStops.forEach((stop, index) => {
        stop.routePlanGroupId = targetGroup.id;
        stop.stopSequence = index + 1;
        if (movingStopIds.has(stop.id)) {
          stop.plannedArrival = null;
          stop.plannedDeparture = null;
        }
        finalStops.push(stop);
      });
      await routePlanStops.save(finalStops);

      const affectedGroups = groups.filter((group) =>
        affectedGroupIds.has(group.id),
      );
      for (const group of affectedGroups) {
        const delta = ensureDelta(group.id);
        group.totalWeightKg = Number(
          Math.max(0, toNumber(group.totalWeightKg) + delta.weightKg).toFixed(2),
        );
        group.totalVolumeM3 = Number(
          Math.max(0, toNumber(group.totalVolumeM3) + delta.volumeM3).toFixed(2),
        );
        group.serviceTimeMinutes = Math.max(
          0,
          toWholeMinutes(group.serviceTimeMinutes) + delta.serviceMinutes,
        );
        group.totalDurationMinutes = Math.max(
          0,
          toWholeMinutes(group.totalDurationMinutes) + delta.durationMinutes,
        );
      }
      await routePlanGroups.save(affectedGroups);

      routePlan.status = 'DRAFT';
      routePlan.warnings = [
        ...(routePlan.warnings || []).filter(
          (warning) =>
            !(
              isObjectRecord(warning) &&
              warning.type === 'MANUAL_BATCH_MOVE_REOPTIMIZE_REQUIRED'
            ),
        ),
        {
          type: 'MANUAL_BATCH_MOVE_REOPTIMIZE_REQUIRED',
          message: `${movingJobIds.length} ${movingJobIds.length === 1 ? 'job was' : 'jobs were'} moved into ${targetGroup.label}. Reoptimize before publish.`,
          jobIds: movingJobIds,
          stopIds: movingStops.map((stop) => stop.id),
          groupId: targetGroup.id,
        },
      ];
      await routePlans.save(routePlan);

      return {
        requestedStopCount: requestedStopIds.size,
        movedStopCount: movingStops.length,
        movedJobCount: movingJobIds.length,
        sourceGroupIds: originalSourceGroupIds,
        targetGroupId: targetGroup.id,
      };
    });

    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'route_plan',
      entityId: routePlanId,
      action: 'route-plan.stops.batch-moved',
      source: 'user',
      newValue: result,
      metadata: { organizationId },
    });
    return this.getRoutePlan(routePlanId, actor);
  }

  async insertJob(
    routePlanId: string,
    groupId: string,
    dto: InsertRoutePlanJobDto,
    actor?: Actor,
  ) {
    const organizationId = this.requireOrganizationId(actor);
    const insertion = await this.dataSource.transaction(async (manager) => {
      const routePlans = manager.getRepository(RoutePlan);
      const routePlanGroups = manager.getRepository(RoutePlanGroup);
      const routePlanStops = manager.getRepository(RoutePlanStop);
      const jobs = manager.getRepository(Job);
      const jobStops = manager.getRepository(JobStop);
      const vehicles = manager.getRepository(Vehicle);
      const drivers = manager.getRepository(Driver);

      const routePlan = await routePlans.findOne({
        where: { id: routePlanId, organizationId },
      });
      if (!routePlan) {
        throw new NotFoundException(`Route plan not found: ${routePlanId}`);
      }
      if (!['DRAFT', 'READY'].includes(routePlan.status)) {
        throw new BadRequestException({
          code: 'ROUTE_INSERTION_PLAN_LOCKED',
          message: 'Only draft or ready route plans can accept inserted jobs.',
        });
      }

      const group = await routePlanGroups.findOne({
        where: { id: groupId, routePlanId },
      });
      if (!group) {
        throw new NotFoundException(`Route plan group not found: ${groupId}`);
      }

      const job = await jobs.findOne({
        where: { id: dto.jobId, organizationId },
      });
      if (!job || job.archivedAt) {
        throw new NotFoundException(`Job not found: ${dto.jobId}`);
      }
      if (
        [JobStatus.COMPLETED, JobStatus.CANCELLED, JobStatus.ARCHIVED].includes(
          job.status,
        )
      ) {
        throw new BadRequestException({
          code: 'ROUTE_INSERTION_JOB_INACTIVE',
          message: 'Completed, cancelled, or archived jobs cannot be inserted.',
        });
      }
      if (job.assignedRouteId) {
        throw new BadRequestException({
          code: 'ROUTE_INSERTION_JOB_ASSIGNED',
          message: 'This job is already assigned to a published route.',
        });
      }

      const existingPlanStop = await routePlanStops.findOne({
        where: { routePlanId, jobId: job.id },
      });
      if (existingPlanStop) {
        throw new BadRequestException({
          code: 'ROUTE_INSERTION_JOB_DUPLICATE',
          message: 'This job is already included in the route plan.',
        });
      }

      const readiness = evaluateJobRoutingReadiness({
        deliveryAddress: job.deliveryAddress,
        timeWindowStart: job.timeWindowStart,
        timeWindowEnd: job.timeWindowEnd,
        estimatedDuration: job.estimatedDuration,
        weight: job.weight,
        volume: job.volume,
        quantity: job.quantity,
        routingRequirements: job.routingRequirements,
      });
      if (!readiness.routable) {
        throw new BadRequestException({
          code: 'ROUTE_INSERTION_JOB_NOT_ROUTABLE',
          message: readiness.summary,
          readiness,
        });
      }

      let sourceStops = await jobStops.find({
        where: { jobId: job.id },
        order: { stopOrder: 'ASC' },
      });
      if (!sourceStops.length) {
        const generatedStops: JobStop[] = [];
        if (job.pickupAddress) {
          generatedStops.push(
            jobStops.create({
              organizationId,
              jobId: job.id,
              stopOrder: 1,
              stopType: 'PICKUP',
              address: job.pickupAddress,
              location: job.pickupLocation || null,
              serviceDurationMinutes: Math.max(
                5,
                Math.round(toNumber(job.estimatedDuration) / 2) || 10,
              ),
              timeWindowStart: job.timeWindowStart,
              timeWindowEnd: job.timeWindowEnd,
              demandWeightKg: this.demandForJob(job).weightKg || null,
              demandVolumeM3: this.demandForJob(job).volumeM3 || null,
              notes: job.specialInstructions || job.notes || null,
            }),
          );
        }
        generatedStops.push(
          jobStops.create({
            organizationId,
            jobId: job.id,
            stopOrder: generatedStops.length + 1,
            stopType: 'DROPOFF',
            address: job.deliveryAddress,
            location: job.deliveryLocation || null,
            serviceDurationMinutes: Math.max(
              10,
              Math.round(toNumber(job.estimatedDuration)) || 15,
            ),
            timeWindowStart: job.timeWindowStart,
            timeWindowEnd: job.timeWindowEnd,
            demandWeightKg: this.demandForJob(job).weightKg || null,
            demandVolumeM3: this.demandForJob(job).volumeM3 || null,
            notes: job.specialInstructions || job.notes || null,
          }),
        );
        sourceStops = await jobStops.save(generatedStops);
      }

      if (!group.vehicleId) {
        throw new BadRequestException({
          code: 'ROUTE_INSERTION_CONSTRAINT',
          message: 'Assign a vehicle before inserting work into this route.',
          constraints: ['vehicle'],
        });
      }
      const vehicle = await vehicles.findOne({
        where: { id: group.vehicleId, organizationId },
      });
      if (!vehicle) {
        throw new BadRequestException({
          code: 'ROUTE_INSERTION_CONSTRAINT',
          message: 'The assigned route vehicle is unavailable.',
          constraints: ['vehicle'],
        });
      }

      const targetStops = await routePlanStops.find({
        where: { routePlanId, routePlanGroupId: groupId },
        order: { stopSequence: 'ASC', createdAt: 'ASC' },
      });
      const existingJobIds = Array.from(
        new Set(targetStops.map((stop) => stop.jobId)),
      );
      const existingJobs = existingJobIds.length
        ? await jobs.find({ where: { id: In(existingJobIds), organizationId } })
        : [];
      const driver = group.driverId
        ? await drivers.findOne({ where: { id: group.driverId, organizationId } })
        : null;
      const routeJobs = [...existingJobs, job];
      const fit = evaluateVehicleLoadFit({ vehicle, driver, jobs: routeJobs });
      if (!fit.fits) {
        throw new BadRequestException({
          code: 'ROUTE_INSERTION_FLEET_CONSTRAINT',
          message: fit.blockers[0]?.message || 'This job does not fit the assigned route.',
          blockers: fit.blockers,
          fit,
        });
      }

      const requestedSequence = Math.min(
        Math.max(1, dto.targetSequence || targetStops.length + 1),
        targetStops.length + 1,
      );
      const position = job.routingRequirements?.sequence?.position;
      const existingJobById = new Map(existingJobs.map((item) => [item.id, item]));
      const existingLastStopIndex = targetStops.findIndex(
        (stop) =>
          existingJobById.get(stop.jobId)?.routingRequirements?.sequence?.position === 'last',
      );
      const targetSequence = position === 'first'
        ? 1
        : position === 'last'
          ? targetStops.length + 1
          : existingLastStopIndex >= 0
            ? Math.min(requestedSequence, existingLastStopIndex + 1)
            : requestedSequence;
      const simulatedJobIds = targetStops.map((stop) => stop.jobId);
      simulatedJobIds.splice(
        targetSequence - 1,
        0,
        ...sourceStops.map(() => job.id),
      );
      const sequenceIssues = this.sequenceConstraintIssues(simulatedJobIds, routeJobs);
      if (sequenceIssues.length) {
        throw new BadRequestException({
          code: 'ROUTE_INSERTION_SEQUENCE_CONSTRAINT',
          message: sequenceIssues[0].message,
          blockers: sequenceIssues,
        });
      }

      const serviceMinutes = sourceStops.reduce(
        (sum, stop) => sum + toWholeMinutes(stop.serviceDurationMinutes),
        0,
      );
      const addedDurationMinutes = serviceMinutes + sourceStops.length * 12;
      const jobDemand = this.demandForJob(job);
      const nextWeightKg = Math.max(
        fit.totals.weightKg,
        toNumber(group.totalWeightKg) + jobDemand.weightKg,
      );
      const nextVolumeM3 = Math.max(
        fit.totals.volumeM3,
        toNumber(group.totalVolumeM3) + jobDemand.volumeM3,
      );
      const nextDurationMinutes =
        toWholeMinutes(group.totalDurationMinutes) + addedDurationMinutes;
      const capacity = this.capacityForVehicle(vehicle);
      const constraints: string[] = [];
      if (nextWeightKg > capacity.maxWeight) constraints.push('weight');
      if (nextVolumeM3 > capacity.maxVolume) constraints.push('volume');
      if (nextDurationMinutes > capacity.maxShiftMinutes) constraints.push('shift');
      if (constraints.length) {
        throw new BadRequestException({
          code: 'ROUTE_INSERTION_CONSTRAINT',
          message: `Insertion exceeds route ${constraints.join(', ')} constraints.`,
          constraints,
          projected: {
            weightKg: Number(nextWeightKg.toFixed(2)),
            volumeM3: Number(nextVolumeM3.toFixed(2)),
            durationMinutes: nextDurationMinutes,
          },
          limits: {
            weightKg: capacity.maxWeight,
            volumeM3: capacity.maxVolume,
            durationMinutes: capacity.maxShiftMinutes,
          },
        });
      }

      const temporarySequenceOffset = 100_000;
      targetStops.forEach((stop, index) => {
        stop.stopSequence = temporarySequenceOffset + index + 1;
      });
      if (targetStops.length) {
        await routePlanStops.save(targetStops);
      }

      const insertedStops = await routePlanStops.save(
        sourceStops.map((sourceStop, index) =>
          routePlanStops.create({
            routePlanId,
            routePlanGroupId: groupId,
            jobId: job.id,
            jobStopId: sourceStop.id,
            stopSequence:
              temporarySequenceOffset + targetStops.length + index + 1,
            isLocked: false,
            plannedArrival: sourceStop.timeWindowStart || job.timeWindowStart,
            plannedDeparture: sourceStop.timeWindowEnd || job.timeWindowEnd,
            metadata: {
              stopType: sourceStop.stopType,
              address: sourceStop.address,
              insertedManually: true,
            },
          }),
        ),
      );
      const orderedStops = [...targetStops];
      orderedStops.splice(targetSequence - 1, 0, ...insertedStops);
      orderedStops.forEach((stop, index) => {
        stop.stopSequence = index + 1;
      });
      await routePlanStops.save(orderedStops);

      group.totalWeightKg = Number(nextWeightKg.toFixed(2));
      group.totalVolumeM3 = Number(nextVolumeM3.toFixed(2));
      group.serviceTimeMinutes =
        toWholeMinutes(group.serviceTimeMinutes) + serviceMinutes;
      group.totalDurationMinutes = nextDurationMinutes;
      await routePlanGroups.save(group);

      routePlan.status = 'DRAFT';
      routePlan.metrics = {
        ...(routePlan.metrics || {}),
        assignedJobCount:
          toWholeMinutes(routePlan.metrics?.assignedJobCount) + 1,
        unassignedJobCount: Math.max(
          0,
          toWholeMinutes(routePlan.metrics?.unassignedJobCount) - 1,
        ),
        totalDurationMinutes:
          toWholeMinutes(routePlan.metrics?.totalDurationMinutes) +
          addedDurationMinutes,
      };
      routePlan.warnings = [
        ...(routePlan.warnings || []).filter(
          (warning) =>
            !(
              isObjectRecord(warning) &&
              warning.type === 'MANUAL_INSERTION_REOPTIMIZE_REQUIRED' &&
              warning.jobId === job.id
            ),
        ),
        {
          type: 'MANUAL_INSERTION_REOPTIMIZE_REQUIRED',
          message: `${job.customerName || job.id} was inserted into ${group.label}. Reoptimize before publish.`,
          jobId: job.id,
          groupId,
        },
      ];
      await routePlans.save(routePlan);

      return {
        jobId: job.id,
        groupId,
        insertedStopCount: insertedStops.length,
      };
    });

    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'route_plan',
      entityId: routePlanId,
      action: 'route-plan.job.inserted',
      source: 'user',
      newValue: insertion,
      metadata: { organizationId },
    });
    return this.getRoutePlan(routePlanId, actor);
  }

  async publish(routePlanId: string, actor?: Actor) {
    const { routePlan, groups, stops } = await this.getRoutePlan(routePlanId, actor);
    if (routePlan.status === 'PUBLISHED') {
      const existingRoutes = (await this.routes.find({
        where: { organizationId: routePlan.organizationId },
        order: { createdAt: 'ASC' },
      }))
        .filter((route) => route.routeData?.routePlanId === routePlanId);
      if (existingRoutes.length) {
        return { ok: true, routePlan, routeRuns: existingRoutes };
      }
    }
    const readiness = await this.buildPublishReadiness(routePlanId, actor);
    if (!readiness.ready) {
      throw new BadRequestException({
        message: 'Route plan is not ready to publish.',
        blockers: readiness.blockingBlockers,
        readiness,
      });
    }
    const byGroup = new Map<string, RoutePlanStop[]>();
    for (const stop of stops) {
      const bucket = byGroup.get(stop.routePlanGroupId) || [];
      bucket.push(stop);
      byGroup.set(stop.routePlanGroupId, bucket);
    }

    const createdRoutes: Route[] = [];
    for (const group of groups) {
      if (!group.vehicleId) {
        continue;
      }
      const groupStops = (byGroup.get(group.id) || []).sort((a, b) => a.stopSequence - b.stopSequence);
      const jobIds = Array.from(new Set(groupStops.map((stop) => stop.jobId)));
      const route = await this.routes.save(this.routes.create({
        organizationId: routePlan.organizationId,
        vehicleId: group.vehicleId,
        driverId: group.driverId || null,
        jobIds,
        routeData: {
          routePlanId,
          routePlanGroupId: group.id,
          publishedAt: new Date().toISOString(),
        },
        status: RouteStatus.ASSIGNED,
        workflowStatus: RouteWorkflowStatus.READY_FOR_DISPATCH,
        totalDistanceKm: group.totalDistanceKm,
        totalDurationMinutes: group.totalDurationMinutes,
        plannedStart: groupStops[0]?.plannedArrival
          ? new Date(groupStops[0].plannedArrival)
          : new Date(`${routePlan.serviceDate}T00:00:00.000Z`),
        jobCount: jobIds.length,
        notes: `Published from route plan ${routePlanId}`,
      }));
      createdRoutes.push(route);

      await this.routeRunStops.save(groupStops.map((stop) => this.routeRunStops.create({
        organizationId: routePlan.organizationId,
        routeId: route.id,
        jobId: stop.jobId,
        jobStopId: stop.jobStopId,
        stopSequence: stop.stopSequence,
        status: 'DISPATCHED',
        plannedArrival: stop.plannedArrival || null,
        proofRequired: false,
        notes: null,
      })));

      await this.routeAssignments.save(this.routeAssignments.create({
        organizationId: routePlan.organizationId,
        routeId: route.id,
        routePlanGroupId: group.id,
        driverId: group.driverId || null,
        vehicleId: group.vehicleId || null,
        assignedByUserId: actor?.userId || null,
        reason: 'Published from planning workspace',
      }));

      if (jobIds.length) {
        await this.jobs.createQueryBuilder()
          .update(Job)
          .set({ assignedRouteId: route.id, status: JobStatus.SCHEDULED })
          .whereInIds(jobIds)
          .execute();
      }
    }

    routePlan.status = 'PUBLISHED';
    routePlan.publishedAt = new Date();
    await this.routePlans.save(routePlan);
    this.audit.record({
      actorId: actor?.userId || 'system',
      actorType: 'user',
      entityType: 'route_plan',
      entityId: routePlanId,
      action: 'route-plan.published',
      source: 'user',
      newValue: { routeCount: createdRoutes.length },
      metadata: { organizationId: routePlan.organizationId },
    });
    return { ok: true, routePlan, routeRuns: createdRoutes };
  }
}
