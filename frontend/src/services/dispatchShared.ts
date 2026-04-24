import type {
  JsonRecord,
  OptimizerHealth,
  RouteRecord,
  RouteStopRecord,
} from './api.types';
import { isRecord } from './api.types';

let latestOptimizerHealth: OptimizerHealth | null = null;

export const getLatestOptimizerHealth = () => latestOptimizerHealth;

export const setLatestOptimizerHealth = (
  health: OptimizerHealth | null,
) => {
  latestOptimizerHealth = health;
};

const toRouteStopRecord = (
  stop: unknown,
  fallbackSequence: number,
): RouteStopRecord => {
  const value = isRecord(stop) ? stop : {};
  const location = isRecord(value.location) ? value.location : {};
  const latitude = Number(
    location.latitude ?? value.latitude ?? value.lat ?? Number.NaN,
  );
  const longitude = Number(
    location.longitude ?? value.longitude ?? value.lng ?? Number.NaN,
  );

  return {
    jobId: String(value.job_id ?? value.jobId ?? ''),
    sequence:
      typeof value.sequence === 'number' ? value.sequence : fallbackSequence,
    address: typeof value.address === 'string' ? value.address : '',
    location:
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { latitude, longitude }
        : undefined,
  };
};

export const sanitizeRoute = (route: unknown): RouteRecord => {
  const value = isRecord(route) ? route : {};
  const routeData = isRecord(value.routeData) ? value.routeData : {};
  const rawDerivedStops = Array.isArray(value.optimizedStops)
    ? value.optimizedStops
    : Array.isArray(routeData.route)
      ? routeData.route
      : [];

  const derivedStops = rawDerivedStops.map((stop, index) =>
    toRouteStopRecord(stop, index + 1),
  );

  const rawDataQuality =
    value.dataQuality ??
    routeData.data_quality ??
    (routeData.is_fallback ? 'simulated' : 'live');
  const dataQuality: RouteRecord['dataQuality'] =
    rawDataQuality === 'degraded' || rawDataQuality === 'simulated'
      ? rawDataQuality
      : 'live';

  const rawOptimizationStatus =
    value.optimizationStatus ??
    routeData.optimization_status ??
    (routeData.is_fallback ? 'degraded' : 'optimized');
  const optimizationStatus: RouteRecord['optimizationStatus'] =
    rawOptimizationStatus === 'degraded' || rawOptimizationStatus === 'failed'
      ? rawOptimizationStatus
      : 'optimized';

  return {
    id:
      typeof value.id === 'string'
        ? value.id
        : `route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    vehicleId:
      typeof value.vehicleId === 'string' ? value.vehicleId : 'unknown-vehicle',
    jobIds: Array.isArray(value.jobIds)
      ? value.jobIds.filter((jobId): jobId is string => typeof jobId === 'string')
      : [],
    driverId: typeof value.driverId === 'string' ? value.driverId : null,
    status: typeof value.status === 'string' ? value.status : 'planned',
    workflowStatus:
      typeof value.workflowStatus === 'string'
        ? value.workflowStatus
        : typeof value.status === 'string'
          ? value.status
          : 'planned',
    totalDistance:
      typeof value.totalDistance === 'number'
        ? value.totalDistance
        : typeof value.totalDistanceKm === 'number'
          ? value.totalDistanceKm
          : undefined,
    totalDuration:
      typeof value.totalDuration === 'number'
        ? value.totalDuration
        : typeof value.totalDurationMinutes === 'number'
          ? value.totalDurationMinutes
          : undefined,
    totalDistanceKm:
      typeof value.totalDistanceKm === 'number' ? value.totalDistanceKm : undefined,
    totalDurationMinutes:
      typeof value.totalDurationMinutes === 'number'
        ? value.totalDurationMinutes
        : undefined,
    optimizedStops: derivedStops,
    polyline: (value.polyline ?? null) as RouteRecord['polyline'],
    routeData: value.routeData as JsonRecord | null,
    dataQuality,
    optimizationStatus,
    planningWarnings: Array.isArray(value.planningWarnings)
      ? value.planningWarnings.filter(
          (warning): warning is string => typeof warning === 'string',
        )
      : Array.isArray(routeData.warnings)
        ? routeData.warnings.filter(
            (warning): warning is string => typeof warning === 'string',
          )
        : [],
    droppedJobIds: Array.isArray(value.droppedJobIds)
      ? value.droppedJobIds.filter((jobId): jobId is string => typeof jobId === 'string')
      : Array.isArray(routeData.dropped_jobs)
        ? routeData.dropped_jobs.filter(
            (jobId): jobId is string => typeof jobId === 'string',
          )
        : [],
    plannerDiagnostics: isRecord(value.plannerDiagnostics)
      ? value.plannerDiagnostics
      : isRecord(routeData.planner_diagnostics)
        ? routeData.planner_diagnostics
        : {},
    simulated: Boolean(value.simulated ?? dataQuality === 'simulated'),
    rerouteState:
      typeof value.rerouteState === 'string'
        ? value.rerouteState
        : typeof routeData.reroute_state === 'string'
          ? routeData.reroute_state
          : null,
    pendingRerouteRequestId:
      typeof value.pendingRerouteRequestId === 'string'
        ? value.pendingRerouteRequestId
        : typeof routeData.pending_reroute_request_id === 'string'
          ? routeData.pending_reroute_request_id
          : null,
    exceptionCategory:
      typeof value.exceptionCategory === 'string'
        ? value.exceptionCategory
        : typeof routeData.exception_category === 'string'
          ? routeData.exception_category
          : null,
    constraintPackId:
      typeof value.constraintPackId === 'string'
        ? value.constraintPackId
        : typeof routeData.constraint_pack_id === 'string'
          ? routeData.constraint_pack_id
          : null,
    estimatedCapacity:
      typeof value.estimatedCapacity === 'number'
        ? value.estimatedCapacity
        : undefined,
    optimizedAt: typeof value.optimizedAt === 'string' ? value.optimizedAt : undefined,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    dispatchedAt:
      typeof value.dispatchedAt === 'string' ? value.dispatchedAt : undefined,
    completedAt:
      typeof value.completedAt === 'string' ? value.completedAt : undefined,
  };
};
