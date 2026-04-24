import type {
  DispatchDriver,
  DispatchJob,
  DispatchVehicle,
} from '../types/dispatch';
import { isAuthBypassed } from './api.session';
import type {
  DispatchTimelineEvent,
  JsonRecord,
  OptimizerHealth,
  PreviewState,
  RouteRecord,
  RouteStopRecord,
  RouteVersion,
  RouteVersionStatus,
  RerouteRequest,
  TrackingLocationsSnapshot,
  TrackingVehicleLocation,
} from './api.types';
import { clonePreview, isRecord } from './api.types';

const PREVIEW_STATE_SEED: PreviewState = {
  jobs: clonePreview<DispatchJob[]>([
    {
      id: 'job-jane-1',
      customerName: 'Jane & Sons Bakery',
      deliveryAddress: '1425 Market Ave, Denver, CO 80202',
      pickupAddress: 'Bakery Loading Dock',
      pickupLocation: { lat: 39.7489, lng: -105.0063 },
      deliveryLocation: { lat: 39.7508, lng: -105.0022 },
      status: 'pending',
      priority: 'high',
      assignedRouteId: 'route-alpha-001',
      createdAt: '2026-04-10T08:30:00.000Z',
    },
    {
      id: 'job-omega-2',
      customerName: 'Omega Medical',
      deliveryAddress: '2100 Santa Fe Dr, Denver, CO 80204',
      pickupAddress: 'Medical Fulfillment Hub',
      pickupLocation: { lat: 39.7449, lng: -105.0126 },
      deliveryLocation: { lat: 39.7523, lng: -104.9892 },
      status: 'pending',
      priority: 'urgent',
      assignedRouteId: 'route-alpha-001',
      createdAt: '2026-04-10T08:45:00.000Z',
    },
    {
      id: 'job-pioneer-3',
      customerName: 'Pioneer Logistics',
      deliveryAddress: '3300 Peña Blvd, Denver, CO 80216',
      pickupAddress: 'Distribution Center',
      pickupLocation: { lat: 39.7898, lng: -104.9725 },
      deliveryLocation: { lat: 39.7333, lng: -104.9875 },
      status: 'pending',
      priority: 'normal',
      assignedRouteId: 'route-beta-002',
      createdAt: '2026-04-10T09:00:00.000Z',
    },
    {
      id: 'job-ridge-4',
      customerName: 'Ridgewood Labs',
      deliveryAddress: '4100 Irving St, Denver, CO 80217',
      pickupAddress: 'Regional Depot',
      pickupLocation: { lat: 39.7625, lng: -105.0214 },
      deliveryLocation: { lat: 39.7491, lng: -105.0011 },
      status: 'pending',
      priority: 'normal',
      assignedRouteId: 'route-gamma-003',
      createdAt: '2026-04-10T09:15:00.000Z',
    },
    {
      id: 'job-river-5',
      customerName: 'Riverfront Catering',
      deliveryAddress: '870 W Evans Ave, Denver, CO 80223',
      pickupAddress: 'Kitchen Hub',
      pickupLocation: { lat: 39.7061, lng: -105.0015 },
      deliveryLocation: { lat: 39.6788, lng: -104.9981 },
      status: 'pending',
      priority: 'low',
      assignedRouteId: null,
      createdAt: '2026-04-10T09:20:00.000Z',
    },
    {
      id: 'job-route-6',
      customerName: 'Route Ops QA',
      deliveryAddress: '1010 Platte St, Denver, CO 80204',
      pickupAddress: 'QA Staging',
      pickupLocation: { lat: 39.7588, lng: -105.0108 },
      deliveryLocation: { lat: 39.7544, lng: -105.0044 },
      status: 'pending',
      priority: 'low',
      assignedRouteId: null,
      createdAt: '2026-04-10T09:25:00.000Z',
    },
  ]),
  routes: clonePreview<RouteRecord[]>([
    {
      id: 'route-alpha-001',
      vehicleId: 'veh-van-1',
      driverId: null,
      status: 'planned',
      totalDistanceKm: 14.7,
      totalDurationMinutes: 35,
      jobIds: ['job-jane-1', 'job-omega-2'],
      workflowStatus: 'planned',
      dataQuality: 'simulated',
      optimizationStatus: 'optimized',
      optimizedStops: [
        {
          jobId: 'job-jane-1',
          sequence: 1,
          address: '1425 Market Ave, Denver, CO 80202',
          location: {
            latitude: 39.7508,
            longitude: -105.0022,
          },
        },
        {
          jobId: 'job-omega-2',
          sequence: 2,
          address: '2100 Santa Fe Dr, Denver, CO 80204',
          location: {
            latitude: 39.7523,
            longitude: -104.9892,
          },
        },
      ],
      routeData: {
        polyline: {
          coordinates: [
            [-105.0022, 39.7508],
            [-105.0056, 39.7497],
            [-104.9892, 39.7523],
          ],
        },
      },
      planningWarnings: ['Simulated planning path used'],
      droppedJobIds: [],
      estimatedCapacity: 1400,
      optimizedAt: '2026-04-10T10:00:00.000Z',
      createdAt: '2026-04-10T09:50:00.000Z',
    },
    {
      id: 'route-beta-002',
      vehicleId: 'veh-van-2',
      driverId: 'driver-anna-2',
      status: 'assigned',
      totalDistanceKm: 9.8,
      totalDurationMinutes: 22,
      jobIds: ['job-pioneer-3'],
      workflowStatus: 'ready_for_dispatch',
      dataQuality: 'live',
      optimizationStatus: 'optimized',
      optimizedStops: [
        {
          jobId: 'job-pioneer-3',
          sequence: 1,
          address: '3300 Peña Blvd, Denver, CO 80216',
          location: {
            latitude: 39.7333,
            longitude: -104.9875,
          },
        },
      ],
      routeData: {
        route: [
          {
            job_id: 'job-pioneer-3',
            sequence: 1,
            address: '3300 Peña Blvd, Denver, CO 80216',
            latitude: 39.7333,
            longitude: -104.9875,
          },
        ],
      },
      estimatedCapacity: 1200,
      createdAt: '2026-04-10T09:55:00.000Z',
    },
    {
      id: 'route-gamma-003',
      vehicleId: 'veh-shuttle-3',
      driverId: 'driver-carl-3',
      status: 'in_progress',
      totalDistanceKm: 21.9,
      totalDurationMinutes: 58,
      jobIds: ['job-ridge-4'],
      workflowStatus: 'in_progress',
      dataQuality: 'simulated',
      optimizationStatus: 'degraded',
      optimizedStops: [
        {
          jobId: 'job-ridge-4',
          sequence: 1,
          address: '4100 Irving St, Denver, CO 80217',
          location: {
            latitude: 39.7491,
            longitude: -105.0011,
          },
        },
      ],
      droppedJobIds: ['job-river-5'],
      planningWarnings: ['One job deferred due route capacity'],
      estimatedCapacity: 1800,
      createdAt: '2026-04-10T08:40:00.000Z',
      dispatchedAt: '2026-04-10T09:10:00.000Z',
    },
  ]),
  drivers: clonePreview<DispatchDriver[]>([
    {
      id: 'driver-anna-2',
      firstName: 'Anna',
      lastName: 'Quinn',
      status: 'on_duty',
      currentHours: 2.1,
      maxHours: 12,
    },
    {
      id: 'driver-carl-3',
      firstName: 'Carl',
      lastName: 'Snyder',
      status: 'on_route',
      currentHours: 6.5,
      maxHours: 10,
    },
  ]),
  vehicles: clonePreview<DispatchVehicle[]>([
    {
      id: 'veh-van-1',
      make: 'Ford',
      model: 'Transit',
      licensePlate: 'DEN-112',
      vehicleType: 'cargo_van',
      status: 'available',
      capacity: 1500,
    },
    {
      id: 'veh-van-2',
      make: 'Chevy',
      model: 'Express',
      licensePlate: 'DEN-220',
      vehicleType: 'box_truck',
      status: 'available',
      capacity: 1200,
    },
    {
      id: 'veh-shuttle-3',
      make: 'Mercedes',
      model: 'Sprinter',
      licensePlate: 'DEN-331',
      vehicleType: 'sprinter_van',
      status: 'in_use',
      capacity: 1800,
    },
    {
      id: 'veh-semi-4',
      make: 'Freightliner',
      model: 'Cascadia',
      licensePlate: 'DEN-808',
      vehicleType: 'semi_truck',
      status: 'available',
      capacity: 18000,
    },
  ]),
  optimizerHealth: {
    status: 'healthy',
    circuitOpen: false,
    consecutiveFailures: 0,
    lastCheckedAt: '2026-04-10T10:09:00.000Z',
    message: 'Simulation mode active (local preview seed).',
  } as OptimizerHealth,
  timeline: clonePreview<DispatchTimelineEvent[]>([
    {
      id: 'timeline-1',
      source: 'system',
      level: 'info',
      code: 'PREVIEW_INIT',
      message: 'Local dispatch board preview seed loaded.',
      action: 'seed_loaded',
      createdAt: '2026-04-10T10:00:00.000Z',
    },
    {
      id: 'timeline-2',
      source: 'workflow',
      level: 'info',
      code: 'PLAN_READY',
      message: 'Route alpha planned with 2 jobs.',
      routeId: 'route-alpha-001',
      action: 'route_planned',
      createdAt: '2026-04-10T10:02:00.000Z',
    },
    {
      id: 'timeline-3',
      source: 'workflow',
      level: 'warning',
      code: 'DEGRADED',
      message: 'Route gamma contains degraded optimization warning.',
      routeId: 'route-gamma-003',
      action: 'optimization_warning',
      createdAt: '2026-04-10T10:05:00.000Z',
    },
  ]),
  routeVersions: {
    'route-alpha-001': clonePreview<RouteVersion[]>([
      {
        id: 'alpha-v1',
        routeId: 'route-alpha-001',
        versionNumber: 1,
        status: 'DRAFT',
        snapshot: { note: 'Initial draft generated from simulated planner.' },
        createdByUserId: 'preview-user',
        createdAt: '2026-04-10T09:57:00.000Z',
      },
      {
        id: 'alpha-v2',
        routeId: 'route-alpha-001',
        versionNumber: 2,
        status: 'REVIEWED',
        snapshot: { note: 'Reviewed by ops lead.' },
        reviewedByUserId: 'preview-user',
        reviewedAt: '2026-04-10T10:03:00.000Z',
        createdByUserId: 'preview-user',
        createdAt: '2026-04-10T10:02:00.000Z',
      },
    ]),
    'route-beta-002': clonePreview<RouteVersion[]>([
      {
        id: 'beta-v1',
        routeId: 'route-beta-002',
        versionNumber: 1,
        status: 'DRAFT',
        snapshot: { note: 'Live assignment seeded for inspection.' },
        createdByUserId: 'preview-user',
        createdAt: '2026-04-10T09:58:00.000Z',
      },
    ]),
    'route-gamma-003': clonePreview<RouteVersion[]>([
      {
        id: 'gamma-v1',
        routeId: 'route-gamma-003',
        versionNumber: 1,
        status: 'APPROVED',
        snapshot: { note: 'Approved for execution from preview seed.' },
        createdByUserId: 'preview-user',
        approvedByUserId: 'preview-user',
        reviewedByUserId: 'preview-user',
        reviewedAt: '2026-04-10T09:40:00.000Z',
        approvedAt: '2026-04-10T09:42:00.000Z',
        createdAt: '2026-04-10T09:35:00.000Z',
      },
    ]),
  },
  rerouteHistory: {
    'route-gamma-003': [
      {
        id: 'reroute-gamma-1',
        routeId: 'route-gamma-003',
        exceptionCategory: 'capacity',
        action: 'defer_job',
        status: 'requested',
        reason: 'Single job deferred to respect route-hours policy',
        requestedAt: '2026-04-10T10:06:00.000Z',
      },
    ],
  },
};

export const previewState = clonePreview(PREVIEW_STATE_SEED);

export const isPreview = () => isAuthBypassed();

export const nowIso = () => new Date().toISOString();

const pickPreviewRoute = (routeId: string) =>
  previewState.routes.find((route) => route.id === routeId);

const pickPreviewVersions = (routeId: string): RouteVersion[] =>
  previewState.routeVersions[routeId] ?? [];

const pickPreviewRerouteHistory = (routeId: string) =>
  previewState.rerouteHistory[routeId] ?? [];

const nextVersionNumber = (routeId: string) =>
  pickPreviewVersions(routeId).reduce(
    (max, version) => Math.max(max, version.versionNumber),
    0,
  ) + 1;

export const getPreviewRoute = (routeId: string): RouteRecord => {
  const route = pickPreviewRoute(routeId);
  if (!route) {
    throw new Error(`Route ${routeId} not found`);
  }
  return route;
};

export const getPreviewReroutes = (routeId: string): RerouteRequest[] =>
  pickPreviewRerouteHistory(routeId).slice();

export const ensurePreviewRouteVersions = (routeId: string): RouteVersion[] =>
  (previewState.routeVersions[routeId] ??= []);

export const getPreviewVersionsForRoute = (routeId: string): RouteVersion[] =>
  ensurePreviewRouteVersions(routeId)
    .slice()
    .sort((left, right) => right.versionNumber - left.versionNumber);

export const getPreviewVersionById = (
  routeId: string,
  versionId: string,
): RouteVersion | null => {
  const versions = pickPreviewVersions(routeId);
  return versions.find((version) => version.id === versionId) ?? null;
};

export const toPreviewRouteVersion = (
  routeId: string,
  status: RouteVersionStatus,
  versionNumber = nextVersionNumber(routeId),
): RouteVersion => ({
  id: `${routeId}-v${String(versionNumber).padStart(3, '0')}`,
  routeId,
  versionNumber,
  status,
  snapshot: { note: `Local preview snapshot for ${status.toLowerCase()}` },
  createdByUserId: 'preview-user',
  reviewedByUserId: null,
  approvedByUserId: null,
  publishedByUserId: null,
  createdAt: nowIso(),
});

const routeHasJob = (route: RouteRecord, jobId: string) =>
  Array.isArray(route.jobIds) && route.jobIds.includes(jobId);

const syncAssignedJobsForRoute = (route: RouteRecord, keepStatus = false) => {
  previewState.jobs.forEach((job) => {
    const currentlyAssigned = job.assignedRouteId === route.id;
    const shouldBeAssigned = routeHasJob(route, job.id);
    if (currentlyAssigned && !shouldBeAssigned) {
      job.assignedRouteId = null;
      if (!keepStatus) {
        job.status = job.status || 'pending';
      }
    }
    if (!currentlyAssigned && shouldBeAssigned) {
      job.assignedRouteId = route.id;
      if (!keepStatus) {
        job.status = 'pending';
      }
    }
  });
};

export const updatePreviewRoute = (
  routeId: string,
  update: (route: RouteRecord) => void,
): RouteRecord => {
  const route = getPreviewRoute(routeId);
  update(route);
  syncAssignedJobsForRoute(route);
  return route;
};

export const previewEvent = (
  routeId: string,
  code: string,
  message: string,
  source: DispatchTimelineEvent['source'] = 'workflow',
  extra: Partial<DispatchTimelineEvent> = {},
): DispatchTimelineEvent => ({
  id: `preview-${routeId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  routeId,
  source,
  level: 'info',
  code,
  message,
  createdAt: nowIso(),
  action: code.toLowerCase(),
  ...extra,
});

const toPreviewCoordinate = (
  stop: RouteStopRecord | JsonRecord,
): { latitude: number; longitude: number } | null => {
  const stopRecord = stop as RouteStopRecord & JsonRecord;
  const location = isRecord(stopRecord.location) ? stopRecord.location : null;
  const latitude = Number(
    (location?.latitude ?? stopRecord.latitude ?? stopRecord.lat) as
      | number
      | string
      | undefined,
  );
  const longitude = Number(
    (location?.longitude ?? stopRecord.longitude ?? stopRecord.lng) as
      | number
      | string
      | undefined,
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
};

export const getPreviewTrackingCoordinate = (
  route: RouteRecord,
): { latitude: number; longitude: number } | null => {
  const stop = route.optimizedStops?.find((item) => Boolean(toPreviewCoordinate(item)));
  if (stop) {
    return toPreviewCoordinate(stop);
  }

  const routeData = isRecord(route.routeData) ? route.routeData : {};
  const rawStops = Array.isArray(routeData.route) ? routeData.route : [];
  const rawStop = rawStops.find((item) => isRecord(item) && Boolean(toPreviewCoordinate(item)));
  return isRecord(rawStop) ? toPreviewCoordinate(rawStop) : null;
};

export const buildPreviewTrackingSnapshot = (): TrackingLocationsSnapshot => {
  const vehicles = previewState.routes
    .filter((route) => route.vehicleId)
    .map((route) => {
      const coordinate = getPreviewTrackingCoordinate(route);
      if (!coordinate) {
        return null;
      }

      const vehicle = previewState.vehicles.find((item) => item.id === route.vehicleId);
      return {
        vehicleId: route.vehicleId,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        timestamp: route.dispatchedAt || route.createdAt || nowIso(),
        vehicleInfo: {
          licensePlate: vehicle?.licensePlate,
          make: vehicle?.make,
          model: vehicle?.model,
          status: vehicle?.status,
        },
      } as TrackingVehicleLocation;
    })
    .filter(
      (item: TrackingVehicleLocation | null): item is TrackingVehicleLocation =>
        Boolean(item),
    );

  return {
    vehicles,
    timestamp: nowIso(),
    count: vehicles.length,
  };
};
