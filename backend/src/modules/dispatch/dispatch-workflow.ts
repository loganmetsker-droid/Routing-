import { RouteStatus, RouteWorkflowStatus } from './entities/route.entity';
import { DataQuality } from './dto/routing-service.dto';

export type RouteWorkflowStatusValue = RouteWorkflowStatus;

export const normalizePlanningMetadata = (data: any): {
  dataQuality: DataQuality;
  optimizationStatus: 'optimized' | 'degraded' | 'failed';
  warnings: string[];
  droppedJobIds: string[];
  plannerDiagnostics: Record<string, any>;
  simulated: boolean;
} => {
  const dataQuality: DataQuality =
    data?.data_quality === 'degraded' || data?.data_quality === 'simulated'
      ? data.data_quality
      : 'live';
  const optimizationStatus =
    data?.optimization_status === 'degraded' || data?.optimization_status === 'failed'
      ? data.optimization_status
      : 'optimized';
  const warnings = Array.isArray(data?.warnings) ? data.warnings : [];
  const droppedJobIds = Array.isArray(data?.dropped_jobs) ? data.dropped_jobs : [];
  const plannerDiagnostics = data?.planner_diagnostics || {};
  const simulated = dataQuality === 'simulated' || data?.is_fallback === true;
  return {
    dataQuality,
    optimizationStatus,
    warnings,
    droppedJobIds,
    plannerDiagnostics,
    simulated,
  };
};

const ROUTE_STATUS_ALIASES: Record<string, RouteStatus> = {
  planned: RouteStatus.PLANNED,
  assigned: RouteStatus.ASSIGNED,
  ready_for_dispatch: RouteStatus.ASSIGNED,
  in_progress: RouteStatus.IN_PROGRESS,
  dispatched: RouteStatus.IN_PROGRESS,
  rerouting: RouteStatus.IN_PROGRESS,
  degraded: RouteStatus.IN_PROGRESS,
  completed: RouteStatus.COMPLETED,
  cancelled: RouteStatus.CANCELLED,
};

export const normalizeIncomingRouteStatus = (
  status: string | RouteStatus,
): RouteStatus => {
  const key = String(status || '').toLowerCase();
  return ROUTE_STATUS_ALIASES[key] || (status as RouteStatus);
};

export const ROUTE_ALLOWED_TRANSITIONS: Record<RouteStatus, RouteStatus[]> = {
  [RouteStatus.PLANNED]: [RouteStatus.ASSIGNED, RouteStatus.IN_PROGRESS, RouteStatus.CANCELLED],
  [RouteStatus.ASSIGNED]: [RouteStatus.PLANNED, RouteStatus.IN_PROGRESS, RouteStatus.CANCELLED],
  [RouteStatus.IN_PROGRESS]: [RouteStatus.COMPLETED, RouteStatus.CANCELLED],
  [RouteStatus.COMPLETED]: [],
  [RouteStatus.CANCELLED]: [RouteStatus.PLANNED],
};

export const isRouteTransitionAllowed = (
  current: string | RouteStatus,
  next: string | RouteStatus,
): boolean => {
  const normalizedCurrent = normalizeIncomingRouteStatus(current);
  const normalizedNext = normalizeIncomingRouteStatus(next);
  if (normalizedCurrent === normalizedNext) return true;
  return (ROUTE_ALLOWED_TRANSITIONS[normalizedCurrent] || []).includes(normalizedNext);
};

export const deriveWorkflowRouteStatus = (
  routeStatus: RouteStatus,
  dataQuality: DataQuality = 'live',
  rerouting = false,
): RouteWorkflowStatus => {
  if (
    rerouting &&
    routeStatus !== RouteStatus.COMPLETED &&
    routeStatus !== RouteStatus.CANCELLED
  ) {
    return RouteWorkflowStatus.REROUTING;
  }
  if (routeStatus === RouteStatus.ASSIGNED) {
    return RouteWorkflowStatus.READY_FOR_DISPATCH;
  }
  if (routeStatus === RouteStatus.IN_PROGRESS) {
    if (dataQuality === 'degraded' || dataQuality === 'simulated') return RouteWorkflowStatus.DEGRADED;
    return RouteWorkflowStatus.IN_PROGRESS;
  }
  if (routeStatus === RouteStatus.COMPLETED) return RouteWorkflowStatus.COMPLETED;
  if (routeStatus === RouteStatus.CANCELLED) return RouteWorkflowStatus.CANCELLED;
  return RouteWorkflowStatus.PLANNED;
};

export const mapLegacyRouteStatusToWorkflowStatus = (
  status: RouteStatus,
): RouteWorkflowStatus => {
  if (status === RouteStatus.ASSIGNED) return RouteWorkflowStatus.READY_FOR_DISPATCH;
  if (status === RouteStatus.IN_PROGRESS) return RouteWorkflowStatus.IN_PROGRESS;
  if (status === RouteStatus.COMPLETED) return RouteWorkflowStatus.COMPLETED;
  if (status === RouteStatus.CANCELLED) return RouteWorkflowStatus.CANCELLED;
  return RouteWorkflowStatus.PLANNED;
};
