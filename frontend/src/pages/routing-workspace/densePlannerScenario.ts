import type { OptimizationObjective } from '@shared/contracts';
import type { DriverRecord, VehicleRecord } from '../../services/api.types';
import type {
  PlannerRoutePlan,
  PlannerRoutePlanGroup,
  PlannerRoutePlanStop,
} from '../../services/plannerApi';
import type { PlannerJobRecord } from './RoutingWorkspaceComponents';

const routeCenters = [
  { city: 'Boulder', lat: 40.0175, lng: -105.2521 },
  { city: 'Broomfield', lat: 39.9287, lng: -105.1306 },
  { city: 'Westminster', lat: 39.8888, lng: -105.0647 },
  { city: 'Arvada', lat: 39.8018, lng: -105.0813 },
  { city: 'Denver', lat: 39.7392, lng: -104.9903 },
  { city: 'Aurora', lat: 39.7402, lng: -104.8354 },
  { city: 'Englewood', lat: 39.6539, lng: -104.9928 },
  { city: 'Centennial', lat: 39.5937, lng: -104.8879 },
] as const;

const largeRouteCenters = [
  ...routeCenters,
  { city: 'Lakewood', lat: 39.7047, lng: -105.0814 },
  { city: 'Golden', lat: 39.7555, lng: -105.2211 },
] as const;

const customerPrefixes = [
  'Cold Chain',
  'Medical Supply',
  'Produce',
  'Bakery',
  'Pharmacy',
  'Catering',
  'Parts Counter',
  'Clinic',
  'Market',
  'Lab Supply',
  'Receiving',
  'Operations',
] as const;

export function buildDenseRouteDayScenario(serviceDate: string) {
  const vehicles = routeCenters.map((center, index) => ({
    id: `dense-vehicle-${index + 1}`,
    licensePlate: `DEN-${110 + index}`,
    make: index % 2 ? 'Mercedes' : 'Ford',
    model: index % 2 ? 'Sprinter' : 'Transit',
    status: 'available',
    currentLocation: { lat: center.lat - 0.01, lng: center.lng - 0.01 },
  })) satisfies VehicleRecord[];

  const drivers = routeCenters.map((_, index) => ({
    id: `dense-driver-${index + 1}`,
    firstName: ['Mara', 'Jon', 'Tess', 'Noah', 'Priya', 'Luis', 'Avery', 'Sam'][index],
    lastName: ['Ellis', 'Reed', 'Carter', 'Banks', 'Patel', 'Morales', 'Stone', 'Ng'][index],
    status: 'available',
  })) satisfies DriverRecord[];

  const groups = routeCenters.map((_, index) => ({
    id: `dense-route-${index + 1}`,
    routePlanId: 'dense-plan',
    groupIndex: index + 1,
    label: `DEN-${110 + index} Run ${index + 1}`,
    driverId: drivers[index].id,
    vehicleId: vehicles[index].id,
    totalDistanceKm: Number((52 + index * 4.8).toFixed(1)),
    totalDurationMinutes: 250 + index * 18,
    serviceTimeMinutes: 15 * 8,
    totalWeightKg: 1400 + index * 110,
    totalVolumeM3: Number((10 + index * 0.6).toFixed(1)),
    warnings: index % 3 === 1 ? ['Late-risk stop needs dispatcher review'] : [],
  })) satisfies PlannerRoutePlanGroup[];

  const assignedJobs: PlannerJobRecord[] = [];
  const stops: PlannerRoutePlanStop[] = [];

  routeCenters.forEach((center, routeIndex) => {
    for (let stopIndex = 0; stopIndex < 15; stopIndex += 1) {
      const absoluteIndex = routeIndex * 15 + stopIndex;
      const latOffset = ((stopIndex % 5) - 2) * 0.011 + Math.floor(stopIndex / 5) * 0.006;
      const lngOffset = (Math.floor(stopIndex / 5) - 1) * 0.014 + (stopIndex % 2 ? 0.004 : -0.004);
      const priority = absoluteIndex % 13 === 0 ? 'urgent' : absoluteIndex % 5 === 0 ? 'high' : 'normal';
      const hasException = absoluteIndex % 17 === 0;
      const isLateRisk = absoluteIndex % 9 === 0;
      const jobId = `dense-job-${absoluteIndex + 1}`;
      const group = groups[routeIndex];

      assignedJobs.push({
        id: jobId,
        customerName: `${customerPrefixes[absoluteIndex % customerPrefixes.length]} ${center.city} ${stopIndex + 1}`,
        deliveryAddress: `${1400 + absoluteIndex} ${center.city} Route Ave, ${center.city}, CO`,
        assignedRouteId: group.id,
        priority,
        status: hasException ? 'exception_pending' : isLateRisk ? 'late_risk' : 'pending',
        deliveryLocation: {
          lat: Number((center.lat + latOffset).toFixed(6)),
          lng: Number((center.lng + lngOffset).toFixed(6)),
        },
      });

      stops.push({
        id: `dense-stop-${absoluteIndex + 1}`,
        routePlanId: 'dense-plan',
        routePlanGroupId: group.id,
        jobId,
        jobStopId: `${jobId}-stop`,
        stopSequence: stopIndex + 1,
        isLocked: absoluteIndex % 11 === 0,
        plannedArrival: null,
        plannedDeparture: null,
        metadata: {
          stopType: 'DELIVERY',
          address: `${1400 + absoluteIndex} ${center.city} Route Ave, ${center.city}, CO`,
          exception: hasException ? 'Dock delay risk' : undefined,
        },
      });
    }
  });

  const unassignedJobs = Array.from({ length: 12 }, (_, index) => {
    const center = routeCenters[index % routeCenters.length];
    return {
      id: `dense-unassigned-job-${index + 1}`,
      customerName: `Unassigned ${customerPrefixes[index % customerPrefixes.length]} ${index + 1}`,
      deliveryAddress: `${2400 + index} Hold Queue Rd, ${center.city}, CO`,
      assignedRouteId: null,
      priority: index % 3 === 0 ? 'high' : 'normal',
      status: index % 4 === 0 ? 'late_risk' : 'pending',
      deliveryLocation: {
        lat: Number((center.lat + 0.04 + index * 0.002).toFixed(6)),
        lng: Number((center.lng - 0.03 - index * 0.002).toFixed(6)),
      },
    } satisfies PlannerJobRecord;
  });

  return {
    plan: {
      id: 'dense-plan',
      serviceDate,
      status: 'draft',
      objective: 'balanced' as OptimizationObjective,
      metrics: {
        routeCount: 8,
        stopCount: 120,
        unassignedJobCount: 12,
      },
      warnings: ['Dense local route-day scenario for product UI stress testing.'],
    } satisfies PlannerRoutePlan,
    jobs: [...assignedJobs, ...unassignedJobs],
    vehicles,
    drivers,
    groups,
    stops,
    unassignedJobs,
  };
}

export function buildDense300StopDayScenario(serviceDate: string) {
  const vehicles = largeRouteCenters.map((center, index) => ({
    id: `dense300-vehicle-${index + 1}`,
    licensePlate: `DEN-${310 + index}`,
    make: index % 2 ? 'Mercedes' : 'Ford',
    model: index % 2 ? 'Sprinter' : 'Transit',
    status: 'available',
    currentLocation: { lat: center.lat - 0.012, lng: center.lng - 0.012 },
  })) satisfies VehicleRecord[];

  const drivers = largeRouteCenters.map((_, index) => ({
    id: `dense300-driver-${index + 1}`,
    firstName: ['Mara', 'Jon', 'Tess', 'Noah', 'Priya', 'Luis', 'Avery', 'Sam', 'Riley', 'Kai'][index],
    lastName: ['Ellis', 'Reed', 'Carter', 'Banks', 'Patel', 'Morales', 'Stone', 'Ng', 'Quinn', 'Morgan'][index],
    status: 'available',
  })) satisfies DriverRecord[];

  const groups = largeRouteCenters.map((_, index) => ({
    id: `dense300-route-${index + 1}`,
    routePlanId: 'dense300-plan',
    groupIndex: index + 1,
    label: `DEN-${310 + index} Run ${index + 1}`,
    driverId: drivers[index].id,
    vehicleId: vehicles[index].id,
    totalDistanceKm: Number((66 + index * 3.7).toFixed(1)),
    totalDurationMinutes: 390 + index * 16,
    serviceTimeMinutes: 15 * 30,
    totalWeightKg: 2600 + index * 135,
    totalVolumeM3: Number((18 + index * 0.75).toFixed(1)),
    warnings: index % 4 === 1 ? ['Blocking exception requires dispatcher review'] : [],
  })) satisfies PlannerRoutePlanGroup[];

  const assignedJobs: PlannerJobRecord[] = [];
  const stops: PlannerRoutePlanStop[] = [];

  largeRouteCenters.forEach((center, routeIndex) => {
    for (let stopIndex = 0; stopIndex < 30; stopIndex += 1) {
      const absoluteIndex = routeIndex * 30 + stopIndex;
      const ring = Math.floor(stopIndex / 6);
      const spoke = stopIndex % 6;
      const latOffset = (spoke - 2.5) * 0.007 + ring * 0.005;
      const lngOffset = (ring - 2) * 0.01 + (spoke % 2 ? 0.004 : -0.004);
      const priority = absoluteIndex % 19 === 0 ? 'urgent' : absoluteIndex % 7 === 0 ? 'high' : 'normal';
      const hasException = absoluteIndex % 23 === 0;
      const isLateRisk = absoluteIndex % 11 === 0;
      const jobId = `dense300-job-${absoluteIndex + 1}`;
      const group = groups[routeIndex];

      assignedJobs.push({
        id: jobId,
        customerName: `${customerPrefixes[absoluteIndex % customerPrefixes.length]} ${center.city} ${stopIndex + 1}`,
        deliveryAddress: `${3200 + absoluteIndex} ${center.city} Route Ave, ${center.city}, CO`,
        assignedRouteId: group.id,
        priority,
        status: hasException ? 'exception_pending' : isLateRisk ? 'late_risk' : 'pending',
        deliveryLocation: {
          lat: Number((center.lat + latOffset).toFixed(6)),
          lng: Number((center.lng + lngOffset).toFixed(6)),
        },
      });

      stops.push({
        id: `dense300-stop-${absoluteIndex + 1}`,
        routePlanId: 'dense300-plan',
        routePlanGroupId: group.id,
        jobId,
        jobStopId: `${jobId}-stop`,
        stopSequence: stopIndex + 1,
        isLocked: absoluteIndex % 13 === 0,
        plannedArrival: null,
        plannedDeparture: null,
        metadata: {
          stopType: 'DELIVERY',
          address: `${3200 + absoluteIndex} ${center.city} Route Ave, ${center.city}, CO`,
          exception: hasException ? 'Dock delay risk' : undefined,
        },
      });
    }
  });

  const unassignedJobs = Array.from({ length: 20 }, (_, index) => {
    const center = largeRouteCenters[index % largeRouteCenters.length];
    return {
      id: `dense300-unassigned-job-${index + 1}`,
      customerName: `Unassigned ${customerPrefixes[index % customerPrefixes.length]} ${index + 1}`,
      deliveryAddress: `${4200 + index} Hold Queue Rd, ${center.city}, CO`,
      assignedRouteId: null,
      priority: index % 4 === 0 ? 'high' : 'normal',
      status: index % 5 === 0 ? 'late_risk' : 'pending',
      deliveryLocation: {
        lat: Number((center.lat + 0.045 + index * 0.0015).toFixed(6)),
        lng: Number((center.lng - 0.035 - index * 0.0015).toFixed(6)),
      },
    } satisfies PlannerJobRecord;
  });

  return {
    plan: {
      id: 'dense300-plan',
      serviceDate,
      status: 'draft',
      objective: 'balanced' as OptimizationObjective,
      metrics: {
        routeCount: 10,
        stopCount: 300,
        unassignedJobCount: 20,
      },
      warnings: ['Dense 300-stop route-day scenario for product UI virtualization testing.'],
    } satisfies PlannerRoutePlan,
    jobs: [...assignedJobs, ...unassignedJobs],
    vehicles,
    drivers,
    groups,
    stops,
    unassignedJobs,
  };
}

export function buildCleanRouteDayScenario(serviceDate: string) {
  const dense = buildDenseRouteDayScenario(serviceDate);
  const jobs = dense.jobs
    .filter((job) => job.assignedRouteId)
    .map((job) => ({
      ...job,
      assignedRouteId: job.assignedRouteId?.replace('dense-route', 'clean-route') || null,
      status: 'pending',
    }));
  const stops = dense.stops.map((stop) => ({
    ...stop,
    metadata: {
      ...stop.metadata,
      exception: undefined,
    },
  }));

  return {
    plan: {
      ...dense.plan,
      id: 'clean-plan',
      metrics: {
        routeCount: dense.groups.length,
        stopCount: stops.length,
        unassignedJobCount: 0,
      },
      warnings: [],
    } satisfies PlannerRoutePlan,
    jobs,
    vehicles: dense.vehicles,
    drivers: dense.drivers,
    groups: dense.groups.map((group) => ({
      ...group,
      id: group.id.replace('dense-route', 'clean-route'),
      routePlanId: 'clean-plan',
      warnings: [],
    })) satisfies PlannerRoutePlanGroup[],
    stops: stops.map((stop) => ({
      ...stop,
      routePlanId: 'clean-plan',
      routePlanGroupId: stop.routePlanGroupId.replace('dense-route', 'clean-route'),
    })) satisfies PlannerRoutePlanStop[],
    unassignedJobs: [] as PlannerJobRecord[],
  };
}

export function buildExceptionRouteDayScenario(serviceDate: string) {
  const clean = buildCleanRouteDayScenario(serviceDate);
  const groups = clean.groups.slice(0, 4).map((group, index) => ({
    ...group,
    id: group.id.replace('clean-route', 'exception-route'),
    routePlanId: 'exception-plan',
    label: group.label.replace('Run', 'Exception Run'),
    driverId: index === 2 ? null : group.driverId,
    vehicleId: index === 3 ? null : group.vehicleId,
    warnings: index === 0 ? ['Dock delay risk requires dispatcher review'] : [],
  })) satisfies PlannerRoutePlanGroup[];
  const groupIdByIndex = new Map(clean.groups.slice(0, 4).map((group, index) => [group.id, groups[index].id]));
  const jobs = clean.jobs
    .filter((job) => job.assignedRouteId && groupIdByIndex.has(job.assignedRouteId))
    .map((job) => ({
      ...job,
      assignedRouteId: groupIdByIndex.get(job.assignedRouteId || '') || job.assignedRouteId,
      status: job.id.endsWith('-6') ? 'exception_pending' : 'pending',
    })) satisfies PlannerJobRecord[];
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const stops = clean.stops
    .filter((stop) => groupIdByIndex.has(stop.routePlanGroupId))
    .map((stop) => {
      const nextGroupId = groupIdByIndex.get(stop.routePlanGroupId) || stop.routePlanGroupId;
      const isStopException = stop.id === 'dense-stop-6';
      return {
        ...stop,
        id: stop.id.replace('dense-stop', 'exception-stop'),
        routePlanId: 'exception-plan',
        routePlanGroupId: nextGroupId,
        metadata: {
          ...stop.metadata,
          exception: isStopException ? 'Customer dock delay risk' : undefined,
        },
      };
    })
    .filter((stop) => jobsById.has(stop.jobId)) satisfies PlannerRoutePlanStop[];

  return {
    plan: {
      ...clean.plan,
      id: 'exception-plan',
      serviceDate,
      metrics: {
        routeCount: groups.length,
        stopCount: stops.length,
        unassignedJobCount: 0,
      },
      warnings: ['Exception route-day scenario for product UI resolution testing.'],
    } satisfies PlannerRoutePlan,
    jobs,
    vehicles: clean.vehicles,
    drivers: clean.drivers,
    groups,
    stops,
    unassignedJobs: [] as PlannerJobRecord[],
  };
}

export function buildSetupRouteDayScenario(serviceDate: string) {
  const dense = buildDenseRouteDayScenario(serviceDate);
  const unassignedJobs = dense.jobs.slice(0, 24).map((job) => ({
    ...job,
    assignedRouteId: null,
    status: job.status === 'exception_pending' ? 'pending' : job.status,
  }));

  return {
    plan: null,
    jobs: unassignedJobs,
    vehicles: dense.vehicles.slice(0, 4),
    drivers: dense.drivers.slice(0, 4),
    groups: [] as PlannerRoutePlanGroup[],
    stops: [] as PlannerRoutePlanStop[],
    unassignedJobs,
  };
}
