/**
 * REST API service for routing backend integration
 * Endpoints: /api/jobs, /api/dispatch/routes, /api/vehicles, /api/drivers
 */

import { unwrapApiData, unwrapListItems, type Vehicle as SharedVehicle, type Driver as SharedDriver, type ManualRouteCreationRequest, type Route as SharedRoute } from '@shared/contracts';
import {
  apiFetch as apiFetchBody,
  getApiBaseUrl,
} from './apiClient';
import {
  apiFetch,
  clearAuthSession,
  createCustomer,
  deleteCustomer,
  getCustomers,
  isAuthBypassed,
  isAuthenticated,
  login,
  setAuthToken,
  updateCustomer,
  validateSession,
  type AuthUser,
  type Customer,
  type LoginResponse,
} from './api.session';
export {
  clearAuthSession,
  createCustomer,
  deleteCustomer,
  getCustomers,
  isAuthBypassed,
  isAuthenticated,
  login,
  setAuthToken,
  updateCustomer,
  validateSession,
};
export type { AuthUser, Customer, LoginResponse };
import { getTrackingSocket } from './socket';
import type { DispatchRouteVersion } from '../features/dispatch/types/dispatch';
import type {
  DispatchDriver,
  DispatchJob,
  DispatchVehicle,
} from '../types/dispatch';

const API_BASE_URL = getApiBaseUrl();

const clonePreview = <T,>(seed: T): T =>
  JSON.parse(JSON.stringify(seed));

type PreviewState = {
  jobs: DispatchJob[];
  routes: Route[];
  drivers: DispatchDriver[];
  vehicles: DispatchVehicle[];
  optimizerHealth: OptimizerHealth;
  timeline: DispatchTimelineEvent[];
  routeVersions: Record<string, DispatchRouteVersion[]>;
  rerouteHistory: Record<string, RerouteRequest[]>;
};

const PREVIEW_STATE_SEED: PreviewState = {
  jobs: clonePreview<DispatchJob[]>([
    {
      id: 'job-jane-1',
      customerName: 'Jane & Sons Bakery',
      deliveryAddress: '1425 Market Ave, Denver, CO 80202',
      pickupAddress: 'Bakery Loading Dock',
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
      status: 'pending',
      priority: 'low',
      assignedRouteId: null,
      createdAt: '2026-04-10T09:25:00.000Z',
    },
  ] as DispatchJob[]),
  routes: clonePreview<Route[]>([
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
          { job_id: 'job-pioneer-3', sequence: 1, address: '3300 Peña Blvd, Denver, CO 80216', latitude: 39.7333, longitude: -104.9875 },
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
  ] as DispatchDriver[]),
  vehicles: clonePreview<DispatchVehicle[]>([
    {
      id: 'veh-van-1',
      make: 'Ford',
      model: 'Transit',
      licensePlate: 'DEN-112',
      status: 'available',
      capacity: 1500,
    },
    {
      id: 'veh-van-2',
      make: 'Chevy',
      model: 'Express',
      licensePlate: 'DEN-220',
      status: 'available',
      capacity: 1200,
    },
    {
      id: 'veh-shuttle-3',
      make: 'Mercedes',
      model: 'Sprinter',
      licensePlate: 'DEN-331',
      status: 'in_use',
      capacity: 1800,
    },
  ] as DispatchVehicle[]),
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
    'route-alpha-001': clonePreview<DispatchRouteVersion[]>([
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
    'route-beta-002': clonePreview<DispatchRouteVersion[]>([
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
    'route-gamma-003': clonePreview<DispatchRouteVersion[]>([
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

const previewState = clonePreview(PREVIEW_STATE_SEED);

const pickPreviewRoute = (routeId: string) =>
  previewState.routes.find((route) => route.id === routeId);

const pickPreviewVersions = (routeId: string): DispatchRouteVersion[] =>
  previewState.routeVersions[routeId] ?? [];

const pickPreviewRerouteHistory = (routeId: string) =>
  previewState.rerouteHistory[routeId] ?? [];

const nextVersionStatus = (routeId: string) =>
  (pickPreviewVersions(routeId).reduce((max, version) => Math.max(max, version.versionNumber), 0) +
    1);

interface Job {
  id: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress: string;
  pickupAddress?: string;
  deliveryAddressStructured?: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    zip: string;
  };
  timeWindow?: { start: string; end: string };
  priority?: string;
  status: string;
  assignedRouteId?: string | null;
  assignedVehicleId?: string;
  stopSequence?: number;
  createdAt?: string;
}

interface Route {
  id: string;
  vehicleId: string;
  jobIds: string[];
  driverId?: string | null;
  status: string;
  totalDistance?: number;
  totalDuration?: number;
  totalDistanceKm?: number;
  totalDurationMinutes?: number;
  optimizedStops?: Array<{
    jobId: string;
    sequence: number;
    address: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  }>;
  routeData?: any;
  dataQuality?: 'live' | 'degraded' | 'simulated';
  optimizationStatus?: 'optimized' | 'degraded' | 'failed';
  planningWarnings?: string[];
  droppedJobIds?: string[];
  plannerDiagnostics?: Record<string, any>;
  workflowStatus?: string;
  simulated?: boolean;
  rerouteState?: string | null;
  pendingRerouteRequestId?: string | null;
  exceptionCategory?: string | null;
  constraintPackId?: string | null;
  estimatedCapacity?: number;
  optimizedAt?: string;
  createdAt?: string;
  dispatchedAt?: string;
  completedAt?: string;
}

export type OptimizerHealth = {
  status: 'healthy' | 'degraded' | 'unavailable';
  circuitOpen: boolean;
  consecutiveFailures: number;
  lastCheckedAt: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  message?: string;
};

export type OptimizerEvent = {
  level: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  fallbackUsed: boolean;
  timestamp: string;
};

export type DispatchTimelineEvent = {
  id: string;
  routeId?: string | null;
  source: 'optimizer' | 'reroute' | 'workflow' | 'system';
  level: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  payload?: Record<string, any> | null;
  reasonCode?: string | null;
  action?: string | null;
  actor?: string | null;
  packId?: string | null;
  createdAt: string;
};

export type RerouteConstraintDiagnostics = {
  feasible: boolean;
  reasonCodes: string[];
  infeasibleJobReasonCodes: Record<string, string[]>;
  impactedJobIds: string[];
  impactedStopIds: string[];
  capacityConflicts: Array<{
    metric: 'weight_kg' | 'volume_m3';
    demand: number;
    capacity: number;
    overBy: number;
  }>;
  timeWindowViolations: Array<{
    jobId: string;
    eta: string;
    windowStart: string;
    windowEnd: string;
    latenessMinutes: number;
  }>;
  skillMismatches: Array<{
    jobId: string;
    requiredSkills: string[];
    availableSkills: string[];
  }>;
  warnings: string[];
  selectedPackId?: string | null;
  packDiagnostics?: Array<{
    packId: string;
    feasible: boolean;
    reasonCodes: string[];
    warnings: string[];
    details?: Record<string, any>;
  }>;
  feasibilityScore?: number;
  conflictSummary?: {
    critical: number;
    major: number;
    minor: number;
    total: number;
  };
};

export type ReroutePreviewAlternative = {
  action: string;
  label: string;
  summary: string;
  feasible: boolean;
  score: number;
  rank: number;
  rationale: string;
  tradeoffs: string[];
};

export type ReroutePreview = {
  beforeSnapshot: Record<string, any>;
  afterSnapshot: Record<string, any>;
  impactSummary: Record<string, any>;
  impliedDataQuality: 'live' | 'degraded' | 'simulated';
  impliedOptimizationStatus: 'optimized' | 'degraded' | 'failed';
  impliedWorkflowStatus: string;
  dispatchBlocked: boolean;
  constraintDiagnostics: RerouteConstraintDiagnostics;
  alternatives: ReroutePreviewAlternative[];
  feasibilitySummary?: {
    score: number;
    feasible: boolean;
    rationale: string;
  };
};

export type RerouteRequest = {
  id: string;
  routeId: string;
  exceptionCategory: string;
  action: string;
  status: 'requested' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  reason: string;
  requestPayload?: Record<string, any> | null;
  beforeSnapshot?: Record<string, any> | null;
  afterSnapshot?: Record<string, any> | null;
  impactSummary?: Record<string, any> | null;
  plannerDiagnostics?: Record<string, any> | null;
  requesterId?: string | null;
  reviewerId?: string | null;
  reviewNote?: string | null;
  appliedBy?: string | null;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  appliedAt?: string | null;
  createdAt?: string;
};

export type TrackingVehicleLocation = {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  vehicleInfo?: {
    licensePlate?: string;
    make?: string;
    model?: string;
    status?: string;
    vehicleType?: string;
  };
};

export type TrackingLocationsSnapshot = {
  vehicles: TrackingVehicleLocation[];
  timestamp: string;
  count: number;
};

export type TrackingStatistics = {
  totalRecords: number;
  vehiclesTracked: number;
  oldestRecord?: string;
  newestRecord?: string;
};

export type TrackingReadiness = {
  ready: boolean;
  checkedAt: string;
  organizationId?: string;
  summary: {
    telemetryRecords: number;
    vehiclesTracked: number;
    activeVehicles: number;
    latestTelemetryAt?: string;
  };
};

let latestOptimizerHealth: OptimizerHealth | null = null;

// Jobs API
export const createJob = async (job: Omit<Job, 'id'>): Promise<{ job: Job }> => {
  const response = await apiFetch('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(job),
  });
  return response.json();
};

// Sanitize job data to ensure required fields
const sanitizeJob = (job: any): Job => ({
  id: job.id || `job-${Date.now()}-${Math.random()}`,
  customerId: job.customerId,
  customerName: job.customerName || 'Unknown Customer',
  customerPhone: job.customerPhone,
  customerEmail: job.customerEmail,
  deliveryAddress: job.deliveryAddress || 'Unknown Address',
  pickupAddress: job.pickupAddress,
  deliveryAddressStructured: job.deliveryAddressStructured,
  timeWindow: job.timeWindow,
  priority: job.priority,
  status: job.status || 'pending',
  assignedRouteId: job.assignedRouteId,
  assignedVehicleId: job.assignedVehicleId,
  stopSequence: job.stopSequence,
  createdAt: job.createdAt,
});

export const getJobs = async (): Promise<Job[]> => {
  if (isPreview()) {
    return clonePreview(previewState.jobs).map(sanitizeJob);
  }

  try {
    const response = await apiFetch('/api/jobs');
    const data = await response.json();
    const rawJobs = unwrapListItems<any>(data, ['jobs', 'items']);
    return rawJobs.map(sanitizeJob);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }
};

export const updateJobStatus = async (id: string, status: string, assignedRouteId?: string): Promise<{ job: Job }> => {
  const response = await apiFetch(`/api/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, assignedRouteId }),
  });
  return response.json();
};

export const updateJob = async (id: string, updates: Partial<Job>): Promise<{ job: Job }> => {
  const response = await apiFetch(`/api/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return response.json();
};

// Routes API
export const createRoute = async (
  route: ManualRouteCreationRequest,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  const response = await apiFetch('/api/dispatch/routes', {
    method: 'POST',
    body: JSON.stringify(route),
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(await response.json());
};

export const generateRoute = async (vehicleId: string, jobIds: string[]): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  return createRoute({ vehicleId, jobIds });
};

export const generateGlobalRoute = async (vehicleIds: string[], jobIds: string[]): Promise<SharedRoute[]> => {
  const response = await apiFetch('/api/dispatch/routes/global', {
    method: 'POST',
    body: JSON.stringify({ vehicleIds, jobIds }),
  });
  const data = await response.json();
  return unwrapListItems<SharedRoute>(data, ['routes', 'items']);
};

// Sanitize route data to ensure required fields
const sanitizeRoute = (route: any): Route => {
  const derivedStops = Array.isArray(route.optimizedStops)
    ? route.optimizedStops
    : Array.isArray(route.routeData?.route)
      ? route.routeData.route.map((stop: any, idx: number) => ({
          jobId: stop.job_id || stop.jobId,
          sequence: stop.sequence ?? idx,
          address: stop.address || '',
        }))
      : undefined;

  const routeData = route.routeData || {};
  const rawDataQuality = route.dataQuality || routeData.data_quality || (routeData.is_fallback ? 'simulated' : 'live');
  const dataQuality: Route['dataQuality'] =
    rawDataQuality === 'degraded' || rawDataQuality === 'simulated' ? rawDataQuality : 'live';
  const rawOptimizationStatus =
    route.optimizationStatus || routeData.optimization_status || (routeData.is_fallback ? 'degraded' : 'optimized');
  const optimizationStatus: Route['optimizationStatus'] =
    rawOptimizationStatus === 'degraded' || rawOptimizationStatus === 'failed'
      ? rawOptimizationStatus
      : 'optimized';
  const planningWarnings = route.planningWarnings || routeData.warnings || [];
  const droppedJobIds = route.droppedJobIds || routeData.dropped_jobs || [];
  const plannerDiagnostics = route.plannerDiagnostics || routeData.planner_diagnostics || {};

  return {
    id: route.id || `route-${Date.now()}-${Math.random()}`,
    vehicleId: route.vehicleId || 'unknown-vehicle',
    jobIds: Array.isArray(route.jobIds) ? route.jobIds : [],
    driverId: route.driverId,
    status: route.status || 'planned',
    totalDistance: route.totalDistance ?? route.totalDistanceKm,
    totalDuration: route.totalDuration ?? route.totalDurationMinutes,
    totalDistanceKm: route.totalDistanceKm,
    totalDurationMinutes: route.totalDurationMinutes,
    optimizedStops: derivedStops,
    routeData: route.routeData,
    dataQuality,
    optimizationStatus,
    planningWarnings,
    droppedJobIds,
    plannerDiagnostics,
    workflowStatus: route.workflowStatus || route.status || 'planned',
    simulated: route.simulated ?? dataQuality === 'simulated',
    rerouteState: route.rerouteState ?? routeData.reroute_state ?? null,
    pendingRerouteRequestId:
      route.pendingRerouteRequestId ?? routeData.pending_reroute_request_id ?? null,
    exceptionCategory: route.exceptionCategory ?? routeData.exception_category ?? null,
    constraintPackId: route.constraintPackId ?? routeData.constraint_pack_id ?? null,
    estimatedCapacity: route.estimatedCapacity,
    optimizedAt: route.optimizedAt,
    createdAt: route.createdAt,
    dispatchedAt: route.dispatchedAt,
    completedAt: route.completedAt,
  };
};

const isPreview = () => isAuthBypassed();

const nowIso = () => new Date().toISOString();

const getPreviewTrackingCoordinate = (route: Route): { latitude: number; longitude: number } | null => {
  const stop = route.optimizedStops?.find((item: any) => {
    const latitude = item?.location?.latitude ?? item?.latitude ?? item?.lat;
    const longitude = item?.location?.longitude ?? item?.longitude ?? item?.lng;
    return Number.isFinite(latitude) && Number.isFinite(longitude);
  });

  if (stop) {
    const previewStop: any = stop;
    return {
      latitude: Number(previewStop.location?.latitude ?? previewStop.latitude ?? previewStop.lat),
      longitude: Number(previewStop.location?.longitude ?? previewStop.longitude ?? previewStop.lng),
    };
  }

  const routeStop = route.routeData?.route?.find((item: any) => {
    const latitude = item?.location?.latitude ?? item?.latitude ?? item?.lat;
    const longitude = item?.location?.longitude ?? item?.longitude ?? item?.lng;
    return Number.isFinite(latitude) && Number.isFinite(longitude);
  });

  if (!routeStop) {
    return null;
  }

  return {
    latitude: Number(routeStop.location?.latitude ?? routeStop.latitude ?? routeStop.lat),
    longitude: Number(routeStop.location?.longitude ?? routeStop.longitude ?? routeStop.lng),
  };
};

const buildPreviewTrackingSnapshot = (): TrackingLocationsSnapshot => {
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
    .filter((item: TrackingVehicleLocation | null): item is TrackingVehicleLocation => Boolean(item));

  return {
    vehicles,
    timestamp: nowIso(),
    count: vehicles.length,
  };
};

const normalizeTrackingLocation = (location: any): TrackingVehicleLocation | null => {
  const latitude = Number(location?.latitude ?? location?.lat ?? location?.location?.lat);
  const longitude = Number(location?.longitude ?? location?.lng ?? location?.location?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    vehicleId: String(location?.vehicleId ?? location?.id ?? ''),
    latitude,
    longitude,
    speed: Number.isFinite(Number(location?.speed)) ? Number(location.speed) : undefined,
    heading: Number.isFinite(Number(location?.heading)) ? Number(location.heading) : undefined,
    timestamp: String(location?.timestamp ?? nowIso()),
    vehicleInfo: location?.vehicleInfo || (location?.licensePlate || location?.make || location?.model
      ? {
          licensePlate: location?.licensePlate,
          make: location?.make,
          model: location?.model,
          status: location?.status,
          vehicleType: location?.vehicleType,
        }
      : undefined),
  };
};

const normalizeTrackingSnapshot = (payload: any): TrackingLocationsSnapshot => {
  const data = payload?.data || payload || {};
  const rawVehicles = Array.isArray(data) ? data : Array.isArray(data.vehicles) ? data.vehicles : [];
  const vehicles = rawVehicles
    .map(normalizeTrackingLocation)
    .filter((item: TrackingVehicleLocation | null): item is TrackingVehicleLocation => Boolean(item));

  return {
    vehicles,
    timestamp: String(data.timestamp || nowIso()),
    count: Number(data.count ?? vehicles.length),
  };
};

export const waitForTrackingEvent = async <T,>(
  eventName: string,
  trigger: () => void,
  fallback: T,
  timeoutMs = 5000,
): Promise<T> => {
  if (isPreview()) {
    return fallback;
  }

  return new Promise((resolve) => {
    const socket = getTrackingSocket();
    let settled = false;
    let timeoutId = 0;

    const cleanup = () => {
      socket.off(eventName, handleEvent);
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleFailure);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };

    const finish = (value: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const handleEvent = (payload: any) => finish((payload?.data || payload) as T);
    const handleConnect = () => trigger();
    const handleFailure = () => finish(fallback);

    socket.on(eventName, handleEvent);
    socket.on('connect', handleConnect);
    socket.on('connect_error', handleFailure);

    timeoutId = window.setTimeout(() => finish(fallback), timeoutMs);

    if (socket.connected) {
      trigger();
    } else {
      socket.connect();
    }
  });
};

const previewEvent = (routeId: string, code: string, message: string, source: DispatchTimelineEvent['source'] = 'workflow', extra: Partial<DispatchTimelineEvent> = {}) =>
  ({
    id: `preview-${routeId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    routeId,
    source,
    level: 'info',
    code,
    message,
    createdAt: nowIso(),
    action: code.toLowerCase(),
    ...extra,
  }) as DispatchTimelineEvent;

const getPreviewRoute = (routeId: string): Route => {
  const route = pickPreviewRoute(routeId);
  if (!route) {
    throw new Error(`Route ${routeId} not found`);
  }
  return route;
};

const syncAssignedJobsForRoute = (route: Route, keepStatus = false) => {
  const routeJobs = new Set(route.jobIds ?? []);
  previewState.jobs.forEach((job) => {
    const currentlyAssigned = job.assignedRouteId === route.id;
    const shouldBeAssigned = routeJobs.has(job.id);
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

const updatePreviewRoute = (routeId: string, update: (route: Route) => void): Route => {
  const route = getPreviewRoute(routeId);
  update(route);
  syncAssignedJobsForRoute(route);
  return route;
};

const getRouteVersionRecords = (routeId: string): DispatchRouteVersion[] =>
  ensurePreviewRouteVersions(routeId);

const ensurePreviewRouteVersions = (routeId: string): DispatchRouteVersion[] =>
  (previewState.routeVersions[routeId] ??= []);

const toPreviewRouteVersion = (routeId: string, status: RouteVersionStatus, previousVersionNumber?: number): DispatchRouteVersion => ({
  id: `${routeId}-v${String(previousVersionNumber ?? nextVersionStatus(routeId)).padStart(3, '0')}`,
  routeId,
  versionNumber: previousVersionNumber ?? nextVersionStatus(routeId),
  status,
  snapshot: { note: `Local preview snapshot for ${status.toLowerCase()}` },
  createdByUserId: 'preview-user',
  reviewedByUserId: null,
  approvedByUserId: null,
  publishedByUserId: null,
  createdAt: nowIso(),
});

const getPreviewVersionsForRoute = (routeId: string): DispatchRouteVersion[] =>
  getRouteVersionRecords(routeId)
    .slice()
    .sort((a, b) => b.versionNumber - a.versionNumber);

const getPreviewVersionById = (routeId: string, versionId: string): DispatchRouteVersion | null => {
  const versions = pickPreviewVersions(routeId);
  return versions.find((version) => version.id === versionId) ?? null;
};

const getPreviewReroutes = (routeId: string): RerouteRequest[] =>
  pickPreviewRerouteHistory(routeId).slice();


export const getRoutes = async (): Promise<Route[]> => {
  if (isPreview()) {
    return clonePreview(previewState.routes).map(sanitizeRoute);
  }

  try {
    const response = await apiFetch('/api/dispatch/routes');
    const data = await response.json();
    if (data?.optimizerHealth) {
      latestOptimizerHealth = data.optimizerHealth;
    }
    const rawRoutes = unwrapListItems<any>(data, ['routes', 'items']);
    return rawRoutes.map(sanitizeRoute);
  } catch (error) {
    console.error('Error fetching routes:', error);
    return [];
  }
};

export const getDispatchOptimizerHealth = async (): Promise<OptimizerHealth | null> => {
  if (isPreview()) {
    return previewState.optimizerHealth;
  }

  try {
    const response = await apiFetch('/api/dispatch/optimizer/health');
    const data = await response.json();
    if (data?.status) {
      latestOptimizerHealth = data;
      return data as OptimizerHealth;
    }
    return latestOptimizerHealth;
  } catch (error) {
    console.error('Error fetching optimizer health:', error);
    return latestOptimizerHealth;
  }
};

export const getDispatchOptimizerEvents = async (
  limit = 20,
): Promise<OptimizerEvent[]> => {
  try {
    const response = await apiFetch(`/api/dispatch/optimizer/events?limit=${limit}`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.events || [];
  } catch (error) {
    console.error('Error fetching optimizer events:', error);
    return [];
  }
};

export const getDispatchTimeline = async (
  params: {
    routeId?: string;
    limit?: number;
    reasonCode?: string;
    action?: string;
    actor?: string;
    source?: 'optimizer' | 'reroute' | 'workflow' | 'system';
    before?: string;
    packId?: string;
  } = {},
): Promise<DispatchTimelineEvent[]> => {
  if (isPreview()) {
    const events = previewState.timeline.filter((event) => {
      if (params.routeId && event.routeId && event.routeId !== params.routeId) return false;
      if (params.source && event.source !== params.source) return false;
      if (params.action && event.action !== params.action) return false;
      if (params.actor && event.actor !== params.actor) return false;
      if (params.reasonCode && event.reasonCode !== params.reasonCode) return false;
      if (params.packId && event.packId !== params.packId) return false;
      return true;
    });

    const sorted = clonePreview(events).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return params.limit ? sorted.slice(0, params.limit) : sorted;
  }

  try {
    const search = new URLSearchParams();
    if (params.routeId) search.set('routeId', params.routeId);
    if (params.limit) search.set('limit', String(params.limit));
    if (params.reasonCode) search.set('reasonCode', params.reasonCode);
    if (params.action) search.set('action', params.action);
    if (params.actor) search.set('actor', params.actor);
    if (params.source) search.set('source', params.source);
    if (params.before) search.set('before', params.before);
    if (params.packId) search.set('packId', params.packId);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const response = await apiFetch(`/api/dispatch/timeline${suffix}`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.events || [];
  } catch (error) {
    console.error('Error fetching dispatch timeline:', error);
    return [];
  }
};

export const requestReroute = async (
  routeId: string,
  payload: {
    exceptionCategory: string;
    action: string;
    reason: string;
    requesterId?: string;
    requestPayload?: Record<string, any>;
    plannerDiagnostics?: Record<string, any>;
  },
): Promise<{ rerouteRequest: RerouteRequest; route: Route }> => {
  if (isPreview()) {
    const route = getPreviewRoute(routeId);
    const rerouteRequest = {
      id: `reroute-${routeId}-${Date.now()}`,
      routeId,
      exceptionCategory: payload.exceptionCategory,
      action: payload.action,
      status: 'requested',
      reason: payload.reason,
      requestPayload: payload.requestPayload ?? null,
      beforeSnapshot: {},
      afterSnapshot: {},
      impactSummary: {},
      plannerDiagnostics: payload.plannerDiagnostics ?? null,
      requestedAt: nowIso(),
      requesterId: payload.requesterId ?? 'preview-user',
      createdAt: nowIso(),
    } as RerouteRequest;
    previewState.rerouteHistory[routeId] = [
      ...getPreviewReroutes(routeId),
      rerouteRequest,
    ];
    route.rerouteState = payload.action;
    route.pendingRerouteRequestId = rerouteRequest.id;
    route.exceptionCategory = payload.exceptionCategory;
    route.planningWarnings = Array.from(
      new Set([
        ...(route.planningWarnings ?? []),
        'Reroute request created in local preview',
      ]),
    );
    previewEvent(routeId, 'REROUTE_REQUESTED', 'Reroute request created in preview mode');
    previewState.timeline = [
      previewEvent(
        routeId,
        'REROUTE_REQUESTED',
        `Reroute request ${rerouteRequest.id} created`,
      ),
      ...previewState.timeline,
    ];
    return { rerouteRequest, route: sanitizeRoute(route) };
  }

  const response = await apiFetch(`/api/dispatch/routes/${routeId}/reroute/request`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return {
    rerouteRequest: data.rerouteRequest,
    route: sanitizeRoute(data.route || {}),
  };
};

export const approveReroute = async (
  routeId: string,
  requestId: string,
  payload: { reviewerId?: string; reviewNote?: string } = {},
): Promise<{ rerouteRequest: RerouteRequest; route: Route }> => {
  if (isPreview()) {
    const route = getPreviewRoute(routeId);
    const history = getPreviewReroutes(routeId);
    const request = history.find((item) => item.id === requestId);
    if (!request) throw new Error(`Reroute request ${requestId} not found`);
    request.status = 'approved';
    request.reviewedAt = nowIso();
    request.reviewerId = payload.reviewerId ?? 'preview-user';
    request.reviewNote = payload.reviewNote ?? null;
    route.pendingRerouteRequestId = null;
    previewState.timeline = [
      previewEvent(
        routeId,
        'REROUTE_APPROVED',
        `Reroute request ${requestId} approved`,
      ),
      ...previewState.timeline,
    ];
    return { rerouteRequest: request, route: sanitizeRoute(route) };
  }

  const response = await apiFetch(`/api/dispatch/routes/${routeId}/reroute/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return {
    rerouteRequest: data.rerouteRequest,
    route: sanitizeRoute(data.route || {}),
  };
};

export const rejectReroute = async (
  routeId: string,
  requestId: string,
  payload: { reviewerId?: string; reviewNote?: string } = {},
): Promise<{ rerouteRequest: RerouteRequest; route: Route }> => {
  if (isPreview()) {
    const route = getPreviewRoute(routeId);
    const history = getPreviewReroutes(routeId);
    const request = history.find((item) => item.id === requestId);
    if (!request) throw new Error(`Reroute request ${requestId} not found`);
    request.status = 'rejected';
    request.reviewedAt = nowIso();
    request.reviewerId = payload.reviewerId ?? 'preview-user';
    request.reviewNote = payload.reviewNote ?? null;
    route.pendingRerouteRequestId = null;
    route.rerouteState = null;
    previewState.timeline = [
      previewEvent(
        routeId,
        'REROUTE_REJECTED',
        `Reroute request ${requestId} rejected`,
      ),
      ...previewState.timeline,
    ];
    return { rerouteRequest: request, route: sanitizeRoute(route) };
  }

  const response = await apiFetch(`/api/dispatch/routes/${routeId}/reroute/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return {
    rerouteRequest: data.rerouteRequest,
    route: sanitizeRoute(data.route || {}),
  };
};

export const applyReroute = async (
  routeId: string,
  requestId: string,
  payload: {
    appliedBy?: string;
    appliedPayload?: Record<string, any>;
    overrideRequested?: boolean;
    overrideReason?: string;
    overrideActor?: string;
    overrideActorRole?: string;
  } = {},
): Promise<{ rerouteRequest: RerouteRequest; route: Route }> => {
  if (isPreview()) {
    const route = getPreviewRoute(routeId);
    const history = getPreviewReroutes(routeId);
    const request = history.find((item) => item.id === requestId);
    if (!request) throw new Error(`Reroute request ${requestId} not found`);
    request.status = 'applied';
    request.appliedAt = nowIso();
    request.appliedBy = payload.appliedBy ?? 'preview-user';
    request.reviewedAt = request.reviewedAt ?? nowIso();
    route.pendingRerouteRequestId = null;
    route.rerouteState = null;
    route.workflowStatus = 'in_progress';
    route.status = route.status === 'completed' ? 'completed' : 'in_progress';
    previewState.timeline = [
      previewEvent(
        routeId,
        'REROUTE_APPLIED',
        `Reroute request ${requestId} applied`,
      ),
      ...previewState.timeline,
    ];
    return { rerouteRequest: request, route: sanitizeRoute(route) };
  }

  const response = await apiFetch(`/api/dispatch/routes/${routeId}/reroute/${requestId}/apply`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return {
    rerouteRequest: data.rerouteRequest,
    route: sanitizeRoute(data.route || {}),
  };
};

export const getRerouteHistory = async (
  routeId: string,
): Promise<RerouteRequest[]> => {
  if (isPreview()) {
    return getPreviewReroutes(routeId);
  }

  try {
    const response = await apiFetch(`/api/dispatch/routes/${routeId}/reroute/history`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.rerouteRequests || [];
  } catch (error) {
    console.error('Error fetching reroute history:', error);
    return [];
  }
};

export const previewReroute = async (
  routeId: string,
  payload: { action: string; payload?: Record<string, any> },
): Promise<ReroutePreview | null> => {
  if (isPreview()) {
    return {
      beforeSnapshot: {},
      afterSnapshot: {},
      impactSummary: {
        score: 0.8,
        feasible: true,
        rationale: 'Local preview reroute simulation complete.',
      },
      impliedDataQuality: 'simulated',
      impliedOptimizationStatus: 'degraded',
      impliedWorkflowStatus: 'planned',
      dispatchBlocked: false,
      constraintDiagnostics: {
        feasible: true,
        reasonCodes: [],
        infeasibleJobReasonCodes: {},
        impactedJobIds: [],
        impactedStopIds: [],
        capacityConflicts: [],
        timeWindowViolations: [],
        skillMismatches: [],
        warnings: [],
      },
      alternatives: [
        {
          action: payload.action,
          label: 'Local preview alternative',
          summary: `Simulated impact for action ${payload.action}`,
          feasible: true,
          score: 0.82,
          rank: 1,
          rationale: 'Generated locally for preview.',
          tradeoffs: ['No external solver run'],
        },
      ],
    };
  }

  try {
    const response = await apiFetch(`/api/dispatch/routes/${routeId}/reroute/preview`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return (data.preview || null) as ReroutePreview | null;
  } catch (error) {
    console.error('Error previewing reroute:', error);
    return null;
  }
};

export const assignDriverToRoute = async (routeId: string, driverId: string): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  if (isPreview()) {
    getPreviewRoute(routeId);
    const driver = previewState.drivers.find((item) => item.id === driverId);
    if (!driver) {
      throw new Error(`Driver ${driverId} not found`);
    }
    const updated = updatePreviewRoute(routeId, (target) => {
      target.driverId = driverId;
      if (target.status === 'planned') {
        target.status = 'assigned';
      }
      target.workflowStatus = target.status;
    });
    driver.status = 'on_route';
    return { route: sanitizeRoute(updated), optimizerHealth: previewState.optimizerHealth };
  }

  const response = await apiFetch(`/api/dispatch/routes/${routeId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ driverId }),
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(await response.json());
};

export const updateRouteStatus = async (routeId: string, status: string): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  const normalizedStatus = status === 'dispatched' ? 'in_progress' : status;

  if (isPreview()) {
    const updated = updatePreviewRoute(routeId, (route) => {
      route.status = normalizedStatus;
      route.workflowStatus = normalizedStatus;
      if (normalizedStatus === 'in_progress') {
        route.dispatchedAt = nowIso();
      }
      if (normalizedStatus === 'completed') {
        route.completedAt = nowIso();
      }
    });
    return { route: sanitizeRoute(updated), optimizerHealth: previewState.optimizerHealth };
  }

  if (normalizedStatus === 'in_progress') {
    return startRoute(routeId);
  }
  if (normalizedStatus === 'completed') {
    return completeRoute(routeId);
  }
  if (normalizedStatus === 'cancelled') {
    return cancelRoute(routeId);
  }

  const response = await apiFetch(`/api/dispatch/routes/${routeId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: normalizedStatus }),
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(await response.json());
};

export const startRoute = async (routeId: string): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  if (isPreview()) {
    const updated = updatePreviewRoute(routeId, (route) => {
      route.status = 'in_progress';
      route.workflowStatus = 'in_progress';
      route.dispatchedAt = nowIso();
    });
    previewState.timeline = [
      previewEvent(routeId, 'ROUTE_STARTED', 'Route started in local preview'),
      ...previewState.timeline,
    ];
    return { route: sanitizeRoute(updated), optimizerHealth: previewState.optimizerHealth };
  }

  const response = await apiFetch(`/api/dispatch/routes/${routeId}/start`, {
    method: 'PATCH',
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(await response.json());
};

export const completeRoute = async (routeId: string): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  if (isPreview()) {
    const updated = updatePreviewRoute(routeId, (route) => {
      route.status = 'completed';
      route.workflowStatus = 'completed';
      route.completedAt = nowIso();
    });
    return { route: sanitizeRoute(updated), optimizerHealth: previewState.optimizerHealth };
  }

  const response = await apiFetch(`/api/dispatch/routes/${routeId}/complete`, {
    method: 'PATCH',
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(await response.json());
};

export const cancelRoute = async (routeId: string): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  if (isPreview()) {
    const updated = updatePreviewRoute(routeId, (route) => {
      route.status = 'cancelled';
      route.workflowStatus = 'cancelled';
    });
    return { route: sanitizeRoute(updated), optimizerHealth: previewState.optimizerHealth };
  }

  const response = await apiFetch(`/api/dispatch/routes/${routeId}/cancel`, {
    method: 'PATCH',
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(await response.json());
};

export const updateRoute = async (routeId: string, updates: Partial<SharedRoute>): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  if (isPreview()) {
    const updated = updatePreviewRoute(routeId, (route) => {
      Object.assign(route, updates as unknown as Route);
      if (updates.status) route.workflowStatus = updates.status;
    });
    return { route: sanitizeRoute(updated), optimizerHealth: previewState.optimizerHealth };
  }

  const response = await apiFetch(`/api/dispatch/routes/${routeId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(await response.json());
};

export const reorderRouteStops = async (routeId: string, newJobOrder: string[]): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  if (isPreview()) {
    const updated = updatePreviewRoute(routeId, (route) => {
      route.jobIds = newJobOrder;
      route.optimizedStops = newJobOrder.map((jobId, index) => ({
        jobId,
        sequence: index + 1,
        address:
          previewState.jobs.find((job) => job.id === jobId)?.deliveryAddress ??
          `Job ${jobId}`,
      }));
    });
    return { route: sanitizeRoute(updated), optimizerHealth: previewState.optimizerHealth };
  }

  const response = await apiFetch(`/api/dispatch/routes/${routeId}/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ newJobOrder }),
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(await response.json());
};

// Vehicles & Drivers API
const sanitizeVehicle = (vehicle: any) => ({
  ...vehicle,
  id: vehicle.id || `vehicle-${Date.now()}-${Math.random()}`,
  status: vehicle.status || 'UNKNOWN',
});

const sanitizeDriver = (driver: any) => ({
  ...driver,
  id: driver.id || `driver-${Date.now()}-${Math.random()}`,
  status: driver.status || 'UNKNOWN',
});

export const createVehicle = async (vehicle: Partial<SharedVehicle>): Promise<{ vehicle: SharedVehicle }> => {
  const response = await apiFetch('/api/vehicles', {
    method: 'POST',
    body: JSON.stringify(vehicle),
  });
  return unwrapApiData<{ vehicle: SharedVehicle }>(await response.json());
};

export const updateVehicle = async (id: string, updates: Partial<SharedVehicle>): Promise<{ vehicle: SharedVehicle }> => {
  const response = await apiFetch(`/api/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return unwrapApiData<{ vehicle: SharedVehicle }>(await response.json());
};

export const deleteVehicle = async (id: string): Promise<void> => {
  await apiFetch(`/api/vehicles/${id}`, { method: 'DELETE' });
};

export const createDriver = async (driver: Partial<SharedDriver>): Promise<{ driver: SharedDriver }> => {
  const response = await apiFetch('/api/drivers', {
    method: 'POST',
    body: JSON.stringify(driver),
  });
  return unwrapApiData<{ driver: SharedDriver }>(await response.json());
};

export const updateDriver = async (id: string, updates: Partial<SharedDriver>): Promise<{ driver: SharedDriver }> => {
  const response = await apiFetch(`/api/drivers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return unwrapApiData<{ driver: SharedDriver }>(await response.json());
};

export const deleteDriver = async (id: string): Promise<void> => {
  await apiFetch(`/api/drivers/${id}`, { method: 'DELETE' });
};

export const getVehicles = async (): Promise<any[]> => {
  if (isPreview()) {
    return clonePreview(previewState.vehicles).map(sanitizeVehicle);
  }

  try {
    const response = await apiFetch('/api/vehicles');
    const data = await response.json();
    const rawVehicles = unwrapListItems<any>(data, ['vehicles', 'items']);
    return rawVehicles.map(sanitizeVehicle);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return [];
  }
};

export const getDrivers = async (): Promise<any[]> => {
  if (isPreview()) {
    return clonePreview(previewState.drivers).map(sanitizeDriver);
  }

  try {
    const response = await apiFetch('/api/drivers');
    const data = await response.json();
    const rawDrivers = unwrapListItems<any>(data, ['drivers', 'items']);
    return rawDrivers.map(sanitizeDriver);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return [];
  }
};

export const getTrackingLocations = async (): Promise<TrackingLocationsSnapshot> => {
  if (isPreview()) {
    return buildPreviewTrackingSnapshot();
  }

  const response = await apiFetch('/api/tracking/overview');
  const payload = await response.json();
  return normalizeTrackingSnapshot({
    vehicles: payload?.vehicles || [],
    timestamp: payload?.generatedAt || nowIso(),
    count: payload?.vehicles?.length || 0,
  });
};

export const subscribeToTrackingLocations = (
  onSnapshot: (snapshot: TrackingLocationsSnapshot) => void,
): (() => void) => {
  if (isPreview()) {
    onSnapshot(buildPreviewTrackingSnapshot());
    return () => undefined;
  }

  const socket = getTrackingSocket();
  const handleSnapshot = (payload: any) => {
    onSnapshot(normalizeTrackingSnapshot(payload));
  };
  const handleConnect = () => {
    socket.emit('subscribe:locations');
  };

  void getTrackingLocations()
    .then((snapshot) => onSnapshot(snapshot))
    .catch((error) => {
      console.error('Error fetching initial tracking snapshot:', error);
    });

  socket.on('vehicle:locations', handleSnapshot);
  socket.on('connect', handleConnect);

  if (socket.connected) {
    socket.emit('subscribe:locations');
  } else {
    socket.connect();
  }

  return () => {
    socket.off('vehicle:locations', handleSnapshot);
    socket.off('connect', handleConnect);
  };
};

export const getVehicleTrackingHistory = async (
  vehicleId: string,
  hours = 24,
): Promise<TrackingVehicleLocation[]> => {
  if (!vehicleId) {
    return [];
  }

  if (isPreview()) {
    return buildPreviewTrackingSnapshot().vehicles.filter((item) => item.vehicleId === vehicleId);
  }

  const response = await apiFetch(`/api/tracking/history/${vehicleId}?hours=${hours}`);
  const payload = await response.json();

  return Array.isArray(payload.history)
    ? payload.history
        .map(normalizeTrackingLocation)
        .filter((item: TrackingVehicleLocation | null): item is TrackingVehicleLocation => Boolean(item))
    : [];
};

export const getTrackingStatistics = async (): Promise<TrackingStatistics | null> => {
  if (isPreview()) {
    const snapshot = buildPreviewTrackingSnapshot();
    return {
      totalRecords: snapshot.count,
      vehiclesTracked: snapshot.count,
      oldestRecord: snapshot.vehicles[0]?.timestamp,
      newestRecord: snapshot.vehicles[0]?.timestamp,
    };
  }

  const readiness = await getTrackingReadiness();
  if (!readiness) {
    return null;
  }

  return {
    totalRecords: readiness.summary.telemetryRecords,
    vehiclesTracked: readiness.summary.vehiclesTracked,
    newestRecord: readiness.summary.latestTelemetryAt,
  };
};

export const getTrackingReadiness = async (): Promise<TrackingReadiness | null> => {
  if (isPreview()) {
    const snapshot = buildPreviewTrackingSnapshot();
    return {
      ready: true,
      checkedAt: nowIso(),
      summary: {
        telemetryRecords: snapshot.count,
        vehiclesTracked: snapshot.count,
        activeVehicles: snapshot.count,
        latestTelemetryAt: snapshot.timestamp,
      },
    };
  }

  try {
    const response = await apiFetch('/api/tracking/readiness');
    return await response.json();
  } catch (error) {
    console.error('Error fetching tracking readiness:', error);
    return null;
  }
};

// SSE for real-time updates
export const connectSSE = (onMessage: (data: any) => void): EventSource => {
  const eventSource = new EventSource(`${API_BASE_URL}/stream-route`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      console.error('SSE parse error:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
  };

  return eventSource;
};

export type RouteVersionStatus =
  | 'DRAFT'
  | 'REVIEWED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'SUPERSEDED';

export type RouteVersion = {
  id: string;
  routeId: string;
  versionNumber: number;
  status: RouteVersionStatus;
  snapshot: Record<string, any>;
  createdByUserId?: string | null;
  reviewedByUserId?: string | null;
  approvedByUserId?: string | null;
  publishedByUserId?: string | null;
  createdAt: string;
  updatedAt?: string;
  reviewedAt?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
};

export const listRouteVersions = async (routeId: string): Promise<RouteVersion[]> => {
  if (isPreview()) {
    return getPreviewVersionsForRoute(routeId).map((version) => ({
      ...version,
      status: version.status,
    }));
  }

  const data = await apiFetchBody<{ versions?: RouteVersion[] } | RouteVersion[]>(
    `/api/dispatch/routes/${routeId}/versions`,
  );
  return Array.isArray(data) ? data : data.versions || [];
};

export const createRouteVersionSnapshot = async (
  routeId: string,
): Promise<RouteVersion> => {
  if (isPreview()) {
    const nextVersion = toPreviewRouteVersion(
      routeId,
      'DRAFT',
      nextVersionStatus(routeId),
    );
    const versions = getRouteVersionRecords(routeId);
    versions.unshift(nextVersion);
    return nextVersion;
  }

  const data = await apiFetchBody<{ version: RouteVersion }>(
    `/api/dispatch/routes/${routeId}/versions/snapshot`,
    {
      method: 'POST',
    },
  );
  return data.version;
};

export const reviewRouteVersion = async (
  routeId: string,
  versionId: string,
): Promise<RouteVersion> => {
  if (isPreview()) {
    const version = getPreviewVersionById(routeId, versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found for route ${routeId}`);
    }
    version.status = 'REVIEWED';
    version.reviewedByUserId = 'preview-user';
    version.reviewedAt = nowIso();
    version.updatedAt = nowIso();
    return version;
  }

  const data = await apiFetchBody<{ version: RouteVersion }>(
    `/api/dispatch/routes/${routeId}/versions/${versionId}/review`,
    {
      method: 'POST',
    },
  );
  return data.version;
};

export const approveRouteVersion = async (
  routeId: string,
  versionId: string,
): Promise<RouteVersion> => {
  if (isPreview()) {
    const version = getPreviewVersionById(routeId, versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found for route ${routeId}`);
    }
    version.status = 'APPROVED';
    version.approvedByUserId = 'preview-user';
    version.approvedAt = nowIso();
    version.updatedAt = nowIso();
    return version;
  }

  const data = await apiFetchBody<{ version: RouteVersion }>(
    `/api/dispatch/routes/${routeId}/versions/${versionId}/approve`,
    {
      method: 'POST',
    },
  );
  return data.version;
};

export const publishRouteVersion = async (
  routeId: string,
  versionId: string,
): Promise<RouteVersion> => {
  if (isPreview()) {
    const version = getPreviewVersionById(routeId, versionId);
    if (!version) {
      throw new Error(`Version ${versionId} not found for route ${routeId}`);
    }
    const versions = getRouteVersionRecords(routeId);
    versions.forEach((candidate) => {
      if (candidate.status === 'PUBLISHED') {
        candidate.status = 'SUPERSEDED';
      }
    });
    version.status = 'PUBLISHED';
    version.publishedAt = nowIso();
    version.publishedByUserId = 'preview-user';
    version.updatedAt = nowIso();
    return version;
  }

  const data = await apiFetchBody<{ version: RouteVersion }>(
    `/api/dispatch/routes/${routeId}/versions/${versionId}/publish`,
    {
      method: 'POST',
    },
  );
  return data.version;
};

export type PlannerRoutePlan = {
  id: string;
  serviceDate: string;
  status: string;
  objective: string;
  metrics?: Record<string, unknown>;
  warnings?: Array<string | Record<string, unknown>>;
};

export type PlannerRoutePlanGroup = {
  id: string;
  routePlanId: string;
  groupIndex: number;
  label: string;
  driverId?: string | null;
  vehicleId?: string | null;
  totalDistanceKm?: number;
  totalDurationMinutes?: number;
  serviceTimeMinutes?: number;
  totalWeightKg?: number;
  totalVolumeM3?: number;
  warnings?: Array<string | Record<string, unknown>>;
};

export type PlannerRoutePlanStop = {
  id: string;
  routePlanId: string;
  routePlanGroupId: string;
  jobId: string;
  jobStopId: string;
  stopSequence: number;
  isLocked: boolean;
  plannedArrival?: string | null;
  plannedDeparture?: string | null;
  metadata?: Record<string, unknown>;
};

export const getPlanner = async (serviceDate: string): Promise<{
  plan?: PlannerRoutePlan | null;
  groups: PlannerRoutePlanGroup[];
  stops: PlannerRoutePlanStop[];
  unassignedJobs: DispatchJob[];
}> => {
  const response = await apiFetchBody<any>(`/api/planner?serviceDate=${encodeURIComponent(serviceDate)}`);
  const data = response?.data || response;
  return {
    plan: data.plan || null,
    groups: data.groups || data.items || [],
    stops: data.stops || [],
    unassignedJobs: data.unassignedJobs || [],
  };
};

export const generateDraftRoutePlan = async (payload: {
  serviceDate: string;
  depotId?: string;
  objective?: string;
  jobIds?: string[];
  vehicleIds?: string[];
}) => {
  const response = await apiFetchBody<any>('/api/route-plans/generate-draft', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response?.data || response;
};

export const getRoutePlan = async (routePlanId: string) => {
  const response = await apiFetchBody<any>(`/api/route-plans/${routePlanId}`);
  return response?.data || response;
};

export const reoptimizeRoutePlan = async (routePlanId: string) =>
  apiFetchBody<any>(`/api/route-plans/${routePlanId}/reoptimize`, { method: 'POST' }).then((response) => response?.data || response);

export const updateRoutePlanGroup = async (
  routePlanId: string,
  groupId: string,
  payload: { driverId?: string; vehicleId?: string },
) => apiFetchBody<any>(`/api/route-plans/${routePlanId}/groups/${groupId}`, {
  method: 'PATCH',
  body: JSON.stringify(payload),
}).then((response) => response?.data || response);

export const updateRoutePlanStop = async (
  routePlanId: string,
  stopId: string,
  payload: { targetGroupId?: string; targetSequence?: number; isLocked?: boolean },
) => apiFetchBody<any>(`/api/route-plans/${routePlanId}/stops/${stopId}`, {
  method: 'PATCH',
  body: JSON.stringify(payload),
}).then((response) => response?.data || response);

export const publishRoutePlan = async (routePlanId: string) =>
  apiFetchBody<any>(`/api/route-plans/${routePlanId}/publish`, { method: 'POST' }).then((response) => response?.data || response);

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  serviceTimezone?: string;
  membership?: { role?: string; roles?: string[] };
};

export const getOrganizations = async (): Promise<OrganizationRecord[]> => {
  const response = await apiFetchBody<any>('/api/organizations');
  const data = response?.data || response;
  return data.organizations || data.items || [];
};

export const getCurrentOrganization = async (): Promise<OrganizationRecord | null> => {
  const response = await apiFetchBody<any>('/api/organizations/current');
  const data = response?.data || response;
  return data.organization || null;
};

export const createOrganization = async (payload: { name: string; slug?: string; serviceTimezone?: string }) => {
  const response = await apiFetchBody<any>('/api/organizations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response?.data || response;
};
