import type { Route as SharedRoute } from '@shared/contracts';
import {
  getPreviewRoute,
  getPreviewReroutes,
  nowIso,
  previewEvent,
  previewState,
  updatePreviewRoute,
} from './api.preview';
import type {
  DispatchTimelineEvent,
  JsonRecord,
  OptimizerEvent,
  OptimizerHealth,
  ReroutePreview,
  RerouteRequest,
  RouteRecord,
} from './api.types';
import { clonePreview } from './api.types';
import { sanitizeRoute } from './dispatchShared';

export const createRoutePreview = async (
  route: { vehicleId: string; jobIds: string[] },
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  const nextRoute = sanitizeRoute({
    id: `route-${Date.now()}`,
    vehicleId: route.vehicleId,
    jobIds: route.jobIds,
    status: 'planned',
    workflowStatus: 'planned',
    optimizedStops: route.jobIds.map((jobId, index) => ({
      jobId,
      sequence: index + 1,
      address:
        previewState.jobs.find((job) => job.id === jobId)?.deliveryAddress ??
        `Job ${jobId}`,
    })),
  });
  previewState.routes.unshift(nextRoute);
  return { route: nextRoute, optimizerHealth: previewState.optimizerHealth };
};

export const generateGlobalRoutePreview = async (
  vehicleIds: string[],
  jobIds: string[],
): Promise<SharedRoute[]> =>
  vehicleIds.map((vehicleId, index) =>
    sanitizeRoute({
      id: `route-${vehicleId}-${Date.now()}-${index}`,
      vehicleId,
      jobIds: jobIds.filter((_, jobIndex) => jobIndex % vehicleIds.length === index),
      status: 'planned',
      workflowStatus: 'planned',
    }),
  );

export const getRoutesPreview = async (): Promise<RouteRecord[]> =>
  clonePreview(previewState.routes).map(sanitizeRoute);

export const getDispatchOptimizerHealthPreview = async (): Promise<OptimizerHealth> =>
  previewState.optimizerHealth;

export const getDispatchOptimizerEventsPreview = async (): Promise<OptimizerEvent[]> => [];

export const getDispatchTimelinePreview = async (
  params: {
    routeId?: string;
    limit?: number;
    reasonCode?: string;
    action?: string;
    actor?: string;
    source?: 'optimizer' | 'reroute' | 'workflow' | 'system';
    packId?: string;
  } = {},
): Promise<DispatchTimelineEvent[]> => {
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
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  return params.limit ? sorted.slice(0, params.limit) : sorted;
};

export const requestReroutePreview = async (
  routeId: string,
  payload: {
    exceptionCategory: string;
    action: string;
    reason: string;
    requesterId?: string;
    requestPayload?: JsonRecord;
    plannerDiagnostics?: JsonRecord;
  },
): Promise<{ rerouteRequest: RerouteRequest; route: RouteRecord }> => {
  const route = getPreviewRoute(routeId);
  const rerouteRequest: RerouteRequest = {
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
  };
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
  previewState.timeline = [
    previewEvent(
      routeId,
      'REROUTE_REQUESTED',
      `Reroute request ${rerouteRequest.id} created`,
    ),
    ...previewState.timeline,
  ];
  return { rerouteRequest, route: sanitizeRoute(route) };
};

const updatePreviewRerouteStatus = (
  routeId: string,
  requestId: string,
  status: RerouteRequest['status'],
  payload: { reviewerId?: string; reviewNote?: string; appliedBy?: string } = {},
): { rerouteRequest: RerouteRequest; route: RouteRecord } => {
  const route = getPreviewRoute(routeId);
  const history = getPreviewReroutes(routeId);
  const request = history.find((item) => item.id === requestId);
  if (!request) {
    throw new Error(`Reroute request ${requestId} not found`);
  }
  request.status = status;
  request.reviewedAt = request.reviewedAt ?? nowIso();
  request.reviewerId = payload.reviewerId ?? request.reviewerId ?? 'preview-user';
  request.reviewNote = payload.reviewNote ?? request.reviewNote ?? null;
  request.appliedBy = payload.appliedBy ?? request.appliedBy ?? null;
  if (status === 'applied') {
    request.appliedAt = nowIso();
  }
  route.pendingRerouteRequestId = null;
  if (status !== 'approved') {
    route.rerouteState = null;
  }
  return { rerouteRequest: request, route: sanitizeRoute(route) };
};

export const approveReroutePreview = async (
  routeId: string,
  requestId: string,
  payload: { reviewerId?: string; reviewNote?: string } = {},
) =>
  updatePreviewRerouteStatus(routeId, requestId, 'approved', payload);

export const rejectReroutePreview = async (
  routeId: string,
  requestId: string,
  payload: { reviewerId?: string; reviewNote?: string } = {},
) =>
  updatePreviewRerouteStatus(routeId, requestId, 'rejected', payload);

export const applyReroutePreview = async (
  routeId: string,
  requestId: string,
  payload: { appliedBy?: string } = {},
) => {
  const result = updatePreviewRerouteStatus(routeId, requestId, 'applied', payload);
  const route = getPreviewRoute(routeId);
  route.workflowStatus = 'in_progress';
  route.status = route.status === 'completed' ? 'completed' : 'in_progress';
  previewState.timeline = [
    previewEvent(routeId, 'REROUTE_APPLIED', `Reroute request ${requestId} applied`),
    ...previewState.timeline,
  ];
  return result;
};

export const getRerouteHistoryPreview = async (
  routeId: string,
): Promise<RerouteRequest[]> => getPreviewReroutes(routeId);

export const previewReroutePreview = async (
  _routeId: string,
  payload: { action: string; payload?: JsonRecord },
): Promise<ReroutePreview> => ({
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
});

export const assignDriverToRoutePreview = async (
  routeId: string,
  driverId: string,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
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
  return {
    route: sanitizeRoute(updated),
    optimizerHealth: previewState.optimizerHealth,
  };
};

export const startRoutePreview = async (
  routeId: string,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
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
};

export const completeRoutePreview = async (
  routeId: string,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  const updated = updatePreviewRoute(routeId, (route) => {
    route.status = 'completed';
    route.workflowStatus = 'completed';
    route.completedAt = nowIso();
  });
  return { route: sanitizeRoute(updated), optimizerHealth: previewState.optimizerHealth };
};

export const cancelRoutePreview = async (
  routeId: string,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  const updated = updatePreviewRoute(routeId, (route) => {
    route.status = 'cancelled';
    route.workflowStatus = 'cancelled';
  });
  return { route: sanitizeRoute(updated), optimizerHealth: previewState.optimizerHealth };
};

export const updateRoutePreview = async (
  routeId: string,
  updates: Partial<SharedRoute>,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  const updated = updatePreviewRoute(routeId, (route) => {
    Object.assign(route, updates as Partial<RouteRecord>);
    if (updates.status) {
      route.workflowStatus = updates.status;
    }
  });
  return { route: sanitizeRoute(updated), optimizerHealth: previewState.optimizerHealth };
};

export const reorderRouteStopsPreview = async (
  routeId: string,
  newJobOrder: string[],
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
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
};
