import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import {
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
import { RoutePlan } from './entities/route-plan.entity';
import { RoutePlanGroup } from './entities/route-plan-group.entity';
import { RoutePlanStop } from './entities/route-plan-stop.entity';
import { GenerateRoutePlanDto } from './dto/generate-route-plan.dto';
import { UpdateRoutePlanGroupDto } from './dto/update-route-plan-group.dto';
import { UpdateRoutePlanStopDto } from './dto/update-route-plan-stop.dto';

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

const ACTIVE_ROUTE_PLAN_STATUSES: RoutePlan['status'][] = [
  'DRAFT',
  'READY',
  'PUBLISHED',
];

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
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
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.routingServiceUrl =
      this.configService.get<string>('ROUTING_SERVICE_URL') ||
      this.configService.get<string>('ROUTING_PROVIDER_URL') ||
      'http://localhost:8000';
  }

  private requireOrganizationId(actor?: Actor) {
    const organizationId = actor?.organizationId;
    if (!organizationId) throw new BadRequestException('organization context required');
    return organizationId;
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
          demandWeightKg: toNumber(job.weight) || null,
          demandVolumeM3: toNumber(job.volume) || null,
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
        demandWeightKg: toNumber(job.weight) || null,
        demandVolumeM3: toNumber(job.volume) || null,
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
      return {
        job,
        stops,
        weight: toNumber(job.weight),
        volume: toNumber(job.volume),
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
  }): OptimizeRequest {
    const planDate = new Date(`${params.serviceDate}T08:00:00.000Z`);
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
          max_route_minutes: capacity.maxShiftMinutes,
        };
      }),
      stops: params.bundles.map((bundle) => ({
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
      })),
    };
  }

  private async callPlannerOptimizer(
    request: OptimizeRequest,
  ): Promise<OptimizeResponse> {
    const requestUrl = `${this.routingServiceUrl}/optimize`;
    const response = (await firstValueFrom(
      this.httpService.post<OptimizeResponse>(requestUrl, request, {
        timeout: 60_000,
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
    const request = this.buildPlannerOptimizeRequest({
      depot: params.depot,
      serviceDate: params.plan.serviceDate,
      objective: params.objective,
      vehicles: params.availableVehicles,
      bundles: params.bundles,
    });
    const optimizeResponse = await this.callPlannerOptimizer(request);
    const objectiveUsed = this.resolveOptimizationObjective(
      optimizeResponse.objective_used || params.objective,
    );
    const groups = this.createDraftGroups(
      params.plan.id,
      params.availableVehicles,
      params.drivers,
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
      targetGroup.entity.totalDurationMinutes = Number(
        (route.total_duration_s / 60).toFixed(2),
      );
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
          Number(group.minutes.toFixed(2)),
        totalDistanceKm:
          group.entity.totalDistanceKm ||
          Number((group.minutes * 0.85).toFixed(2)),
        warnings: group.entity.vehicleId ? [] : ['No vehicle assigned'],
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
      for (const orderedStop of route.ordered_stops) {
        const bundle = bundleByJobId.get(orderedStop.stop_id);
        if (!bundle) continue;
        for (const stop of bundle.stops) {
          const locked = params.lockedStops.get(stop.id);
          planStops.push(
            this.routePlanStops.create({
              routePlanId: params.plan.id,
              routePlanGroupId: savedGroup.id,
              jobId: bundle.job.id,
              jobStopId: stop.id,
              stopSequence: sequence,
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
          sequence += 1;
        }
      }
    }

    const unassigned = params.bundles
      .filter((bundle) => !assignedJobIds.has(bundle.job.id))
      .map((bundle) => ({
        jobId: bundle.job.id,
        reason: 'optimizer dropped bundle under current constraints',
      }));

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
        ...optimizeResponse.warnings,
        ...unassigned.map((item) => ({ ...item, type: 'UNASSIGNED_JOB' })),
        {
          type: 'OPTIMIZER_OBJECTIVE',
          objectiveUsed,
          label: getOptimizationObjectiveLabel(objectiveUsed),
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
    );
    const savedGroups = await this.saveDraftGroups(allocatedGroups);
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
    for (let index = 0; index < Math.max(availableVehicles.length, 1); index += 1) {
      const vehicle = availableVehicles[index];
      const driver = drivers[index] || null;
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
  ) {
    const unassigned: Array<{ jobId: string; reason: string }> = [];

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
        if (
          candidate.weight + bundle.weight <= capacity.maxWeight &&
          candidate.volume + bundle.volume <= capacity.maxVolume &&
          totalMinutes <= capacity.maxShiftMinutes
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
        totalDurationMinutes: group.minutes,
        totalDistanceKm: Number((group.minutes * 0.85).toFixed(2)),
        warnings: group.entity.vehicleId ? [] : ['No vehicle assigned'],
      })),
    );
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
      for (const bundle of source.bundles) {
        for (const stop of bundle.stops) {
          const locked = lockedStops.get(stop.id);
          planStops.push(
            this.routePlanStops.create({
              routePlanId,
              routePlanGroupId: group.id,
              jobId: bundle.job.id,
              jobStopId: stop.id,
              stopSequence: locked?.stopSequence || sequence,
              isLocked: Boolean(locked?.isLocked),
              plannedArrival: stop.timeWindowStart || bundle.job.timeWindowStart,
              plannedDeparture: stop.timeWindowEnd || bundle.job.timeWindowEnd,
              metadata: {
                stopType: stop.stopType,
                address: stop.address,
              },
            }),
          );
          sequence += 1;
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
    let plan = await this.routePlans.findOne({
      where: { organizationId, serviceDate: dto.serviceDate, status: 'DRAFT' },
    });
    const lockedStops = plan ? await this.getLockedStops(plan.id) : new Map<string, RoutePlanStop>();
    const previousGroups = plan
      ? await this.routePlanGroups.find({
          where: { routePlanId: plan.id },
          order: { groupIndex: 'ASC' },
        })
      : [];
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

  async updateGroup(routePlanId: string, groupId: string, dto: UpdateRoutePlanGroupDto, actor?: Actor) {
    const view = await this.getRoutePlan(routePlanId, actor);
    const group = view.groups.find((item) => item.id === groupId);
    if (!group) throw new NotFoundException(`Route plan group not found: ${groupId}`);
    if (dto.driverId !== undefined) group.driverId = dto.driverId || null;
    if (dto.vehicleId !== undefined) group.vehicleId = dto.vehicleId || null;
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
    const sourceGroupId = stop.routePlanGroupId;
    const targetGroupId = dto.targetGroupId || stop.routePlanGroupId;
    const targetSequence = Math.max(1, dto.targetSequence || stop.stopSequence || 1);
    if (dto.isLocked !== undefined) stop.isLocked = dto.isLocked;

    const targetSiblings = await this.routePlanStops.find({
      where: { routePlanId, routePlanGroupId: targetGroupId },
      order: { stopSequence: 'ASC', createdAt: 'ASC' },
    });
    const reorderedTarget = targetSiblings.filter((candidate) => candidate.id !== stop.id);
    stop.routePlanGroupId = targetGroupId;
    reorderedTarget.splice(Math.min(targetSequence - 1, reorderedTarget.length), 0, stop);
    reorderedTarget.forEach((candidate, index) => {
      candidate.stopSequence = index + 1;
    });
    await this.routePlanStops.save(reorderedTarget);

    if (sourceGroupId !== targetGroupId) {
      const sourceSiblings = await this.routePlanStops.find({
        where: { routePlanId, routePlanGroupId: sourceGroupId },
        order: { stopSequence: 'ASC', createdAt: 'ASC' },
      });
      sourceSiblings.forEach((candidate, index) => {
        candidate.stopSequence = index + 1;
      });
      await this.routePlanStops.save(sourceSiblings);
    }
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
      return { ok: true, routePlan, routeRuns: existingRoutes };
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
