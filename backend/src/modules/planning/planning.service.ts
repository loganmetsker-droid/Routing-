import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../../common/audit/audit.service';
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
  sortKey: string;
};

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
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
    private readonly audit: AuditService,
  ) {}

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
          location: (job.pickupLocation as any) || null,
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
        location: (job.deliveryLocation as any) || null,
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

  private buildJobBundles(jobs: Job[], stopsByJob: Map<string, JobStop[]>) {
    return jobs.map((job) => {
      const stops = (stopsByJob.get(job.id) || []).slice().sort((a, b) => a.stopOrder - b.stopOrder);
      const firstWindow = stops[0]?.timeWindowStart || job.timeWindowStart;
      return {
        job,
        stops,
        weight: toNumber(job.weight),
        volume: toNumber(job.volume),
        serviceMinutes: stops.reduce((sum, stop) => sum + Math.max(1, stop.serviceDurationMinutes || 0), 0),
        sortKey: [
          10 - priorityWeight(job.priority),
          firstWindow ? new Date(firstWindow).toISOString() : '9999-12-31T00:00:00.000Z',
          job.id,
        ].join('|'),
      } satisfies PlannedJobBundle;
    }).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  private capacityForVehicle(vehicle: Vehicle) {
    return {
      maxWeight: toNumber(vehicle.capacityWeightKg) || 999999,
      maxVolume: toNumber(vehicle.capacityVolumeM3) || 999999,
      maxShiftMinutes: toNumber((vehicle.metadata as any)?.maxShiftMinutes) || 480,
    };
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
      where: { organizationId, serviceDate, status: In(['DRAFT', 'READY', 'PUBLISHED']) as any },
      order: { updatedAt: 'DESC' },
    });
    const groups = plan ? await this.routePlanGroups.find({ where: { routePlanId: plan.id }, order: { groupIndex: 'ASC' } }) : [];
    const stops = plan ? await this.routePlanStops.find({ where: { routePlanId: plan.id }, order: { stopSequence: 'ASC' } }) : [];
    const jobs = await this.jobs.find({ where: { organizationId, archivedAt: null as any } as any, order: { createdAt: 'ASC' } });
    const unassignedJobs = jobs.filter((job) => !groups.length || !stops.some((stop) => stop.jobId === job.id));
    return { ok: true, serviceDate, plan, groups, stops, unassignedJobs };
  }

  async generateDraft(dto: GenerateRoutePlanDto, actor?: Actor) {
    const organizationId = this.requireOrganizationId(actor);
    const depot = await this.ensureDepot(organizationId, dto.depotId);
    let plan = await this.routePlans.findOne({ where: { organizationId, serviceDate: dto.serviceDate, status: 'DRAFT' } as any });
    const lockedStops = plan ? await this.getLockedStops(plan.id) : new Map<string, RoutePlanStop>();
    if (!plan) {
      plan = await this.routePlans.save(this.routePlans.create({
        organizationId,
        serviceDate: dto.serviceDate,
        depotId: depot.id,
        objective: dto.objective || 'distance',
        status: 'DRAFT',
        metrics: {},
        warnings: [],
        createdByUserId: actor?.userId,
      }));
    } else {
      await this.clearPlan(plan.id);
      plan.depotId = depot.id;
      plan.objective = dto.objective || plan.objective;
      plan.status = 'DRAFT';
      plan = await this.routePlans.save(plan);
    }

    const jobs = await this.jobs.find({
      where: {
        organizationId,
        ...(dto.jobIds?.length ? { id: In(dto.jobIds) } : {}),
      } as any,
      order: { createdAt: 'ASC' },
    });
    const candidateJobs = jobs.filter((job) => ![JobStatus.COMPLETED, JobStatus.CANCELLED, JobStatus.ARCHIVED].includes(job.status));
    const vehicles = await this.vehicles.find({
      where: { organizationId, ...(dto.vehicleIds?.length ? { id: In(dto.vehicleIds) } : {}) } as any,
      order: { createdAt: 'ASC' },
    });
    const availableVehicles = vehicles.filter((vehicle) => String(vehicle.status || '').toLowerCase() !== 'maintenance');
    const drivers = await this.drivers.find({ where: { organizationId } as any, order: { createdAt: 'ASC' } });
    const stopsByJob = await this.ensureJobStopsForJobs(candidateJobs, organizationId);
    const bundles = this.buildJobBundles(candidateJobs, stopsByJob);

    const warnings: Array<string | Record<string, unknown>> = [];
    if (!availableVehicles.length) {
      warnings.push('No vehicles available for planning; draft contains only unassigned work.');
    }

    const groups: Array<{ entity: RoutePlanGroup; bundles: PlannedJobBundle[]; weight: number; volume: number; minutes: number }> = [];
    for (let index = 0; index < Math.max(availableVehicles.length, 1); index += 1) {
      const vehicle = availableVehicles[index];
      const driver = drivers[index] || null;
      groups.push({
        entity: this.routePlanGroups.create({
          routePlanId: plan.id,
          groupIndex: index + 1,
          label: vehicle ? `${vehicle.licensePlate || vehicle.make} Run ${index + 1}` : `Unassigned Group ${index + 1}`,
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

    const unassigned: Array<{ jobId: string; reason: string }> = [];

    for (const bundle of bundles) {
      let target = groups[0];
      let chosen = false;
      for (const candidate of groups) {
        const vehicle = availableVehicles.find((item) => item.id === candidate.entity.vehicleId);
        const capacity = vehicle ? this.capacityForVehicle(vehicle) : { maxWeight: 999999, maxVolume: 999999, maxShiftMinutes: 480 };
        const totalMinutes = candidate.minutes + bundle.serviceMinutes + bundle.stops.length * 12;
        if (candidate.weight + bundle.weight <= capacity.maxWeight && candidate.volume + bundle.volume <= capacity.maxVolume && totalMinutes <= capacity.maxShiftMinutes) {
          target = candidate;
          chosen = true;
          break;
        }
      }
      if (!chosen && availableVehicles.length) {
        unassigned.push({ jobId: bundle.job.id, reason: 'capacity or shift constraints exceeded' });
        continue;
      }
      target.bundles.push(bundle);
      target.weight += bundle.weight;
      target.volume += bundle.volume;
      target.minutes += bundle.serviceMinutes + bundle.stops.length * 12;
    }

    const savedGroups = await this.routePlanGroups.save(groups.map((group) => ({
      ...group.entity,
      totalWeightKg: Number(group.weight.toFixed(2)),
      totalVolumeM3: Number(group.volume.toFixed(2)),
      serviceTimeMinutes: group.bundles.reduce((sum, bundle) => sum + bundle.serviceMinutes, 0),
      totalDurationMinutes: group.minutes,
      totalDistanceKm: Number((group.minutes * 0.85).toFixed(2)),
      warnings: group.entity.vehicleId ? [] : ['No vehicle assigned'],
    })));

    const planStops: RoutePlanStop[] = [];
    savedGroups.forEach((group, groupIndex) => {
      const source = groups[groupIndex];
      let sequence = 1;
      for (const bundle of source.bundles) {
        for (const stop of bundle.stops) {
          const locked = lockedStops.get(stop.id);
          planStops.push(this.routePlanStops.create({
            routePlanId: plan.id,
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
          }));
          sequence += 1;
        }
      }
    });
    await this.routePlanStops.save(planStops.sort((a, b) => a.stopSequence - b.stopSequence));

    plan.metrics = {
      routeCount: savedGroups.length,
      assignedJobCount: groups.reduce((sum, group) => sum + group.bundles.length, 0),
      unassignedJobCount: unassigned.length,
      totalDistanceKm: savedGroups.reduce((sum, group) => sum + toNumber(group.totalDistanceKm), 0),
      totalDurationMinutes: savedGroups.reduce((sum, group) => sum + toNumber(group.totalDurationMinutes), 0),
    };
    plan.warnings = [...warnings, ...unassigned.map((item) => ({ ...item, type: 'UNASSIGNED_JOB' }))];
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
      objective: plan.objective,
      vehicleIds,
      jobIds,
    }, actor);
  }

  async getRoutePlan(routePlanId: string, actor?: Actor) {
    const organizationId = this.requireOrganizationId(actor);
    const plan = await this.routePlans.findOne({ where: { id: routePlanId, organizationId } });
    if (!plan) throw new NotFoundException(`Route plan not found: ${routePlanId}`);
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
      newValue: dto as any,
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
      const existingRoutes = (await this.routes.find({ where: { organizationId: routePlan.organizationId } as any, order: { createdAt: 'ASC' } }))
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
      } as Route));
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
