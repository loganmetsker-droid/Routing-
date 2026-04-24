import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../services/apiClient';
import { isPreview, nowIso, previewState } from '../../../services/api.preview';
import { getErrorMessage, isRecord } from '../../../services/api.types';
import { queryKeys } from '../../../services/queryKeys';

export type RouteRunRecord = {
  id: string;
  organizationId?: string | null;
  vehicleId?: string | null;
  driverId?: string | null;
  status: string;
  workflowStatus?: string | null;
  totalDistanceKm?: number | null;
  totalDurationMinutes?: number | null;
  plannedStart?: string | null;
  actualStart?: string | null;
  completedAt?: string | null;
  jobCount?: number | null;
  notes?: string | null;
  routeData?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RouteRunStopRecord = {
  id: string;
  organizationId?: string | null;
  routeId: string;
  jobId: string;
  jobStopId: string;
  stopSequence: number;
  status: string;
  plannedArrival?: string | null;
  actualArrival?: string | null;
  actualDeparture?: string | null;
  proofRequired?: boolean;
  notes?: string | null;
};

export type DispatchExceptionRecord = {
  id: string;
  organizationId?: string | null;
  routeId?: string | null;
  routeRunStopId?: string | null;
  code: string;
  message: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  details?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type StopEventRecord = {
  id: string;
  routeRunStopId: string;
  eventType: string;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
  happenedAt?: string;
};

export type ProofArtifactRecord = {
  id: string;
  routeRunStopId: string;
  type: string;
  uri: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type NotificationDeliveryRecord = {
  id: string;
  routeId?: string | null;
  routeRunStopId?: string | null;
  jobId?: string | null;
  eventType: string;
  channel: 'EMAIL' | 'SMS';
  recipient: string;
  provider: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  subject?: string | null;
  message: string;
  trackingUrl?: string | null;
  failureReason?: string | null;
  sentAt?: string | null;
  createdAt?: string;
};

export type RouteRunDetailRecord = {
  routeRun: RouteRunRecord;
  stops: RouteRunStopRecord[];
  exceptions: DispatchExceptionRecord[];
  stopEvents: StopEventRecord[];
  proofArtifacts: ProofArtifactRecord[];
  notificationDeliveries: NotificationDeliveryRecord[];
};

export type RouteRunShareLinkRecord = {
  token: string;
  url: string;
  expiresAt: string;
};

export type DispatchMoveStopPayload = {
  jobId: string;
  targetRouteId: string;
  targetSequence: number;
};

export type CreateExceptionPayload = {
  routeId?: string | null;
  routeRunStopId?: string | null;
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

const previewRouteRuns = (): RouteRunRecord[] =>
  previewState.routes.map((route) => ({
    id: route.id,
    organizationId: 'preview-org',
    vehicleId: route.vehicleId || null,
    driverId: route.driverId || null,
    status:
      route.status === 'assigned'
        ? 'ready_for_dispatch'
        : route.status === 'planned'
          ? 'assigned'
          : route.status,
    workflowStatus: route.workflowStatus || route.status,
    totalDistanceKm: route.totalDistanceKm || null,
    totalDurationMinutes: route.totalDurationMinutes || null,
    plannedStart: route.createdAt || null,
    actualStart: route.dispatchedAt || null,
    jobCount: route.jobIds.length,
    notes: route.planningWarnings?.join(' • ') || null,
    routeData: isRecord(route.routeData) ? route.routeData : null,
    createdAt: route.createdAt,
    updatedAt: route.createdAt,
  }));

const previewRouteRunStops = (): RouteRunStopRecord[] =>
  previewState.routes.flatMap((route) =>
    route.jobIds.map((jobId, index) => ({
      id: `${route.id}-stop-${index + 1}`,
      organizationId: 'preview-org',
      routeId: route.id,
      jobId,
      jobStopId: `${jobId}-stop`,
      stopSequence: index + 1,
      status:
        route.status === 'in_progress'
          ? index === 0
            ? 'ARRIVED'
            : 'PENDING'
          : 'PENDING',
      plannedArrival: route.createdAt || null,
      actualArrival:
        route.status === 'in_progress' && index === 0 ? route.dispatchedAt || null : null,
      actualDeparture: null,
      proofRequired: index === route.jobIds.length - 1,
      notes: null,
    })),
  );

const buildPreviewSeedExceptions = (): DispatchExceptionRecord[] =>
  previewState.routes
    .filter((route) => route.status === 'in_progress' || route.planningWarnings?.length)
    .map((route) => ({
      id: `exception-${route.id}`,
      organizationId: 'preview-org',
      routeId: route.id,
      routeRunStopId: null,
      code: route.status === 'in_progress' ? 'DELAY' : 'CAPACITY',
      message:
        route.status === 'in_progress'
          ? 'Route is running behind planned arrival.'
          : route.planningWarnings?.[0] || 'Planner warning requires review.',
      status: route.status === 'in_progress' ? 'OPEN' : 'ACKNOWLEDGED',
      details: {},
      createdAt: route.createdAt,
      updatedAt: route.createdAt,
    }));

const previewExceptionStore: DispatchExceptionRecord[] = buildPreviewSeedExceptions();

const previewExceptions = (): DispatchExceptionRecord[] =>
  previewExceptionStore
    .slice()
    .sort((left, right) =>
      String(right.createdAt || '').localeCompare(String(left.createdAt || '')),
    );

const rebuildPreviewRoute = (routeId: string) => {
  const route = previewState.routes.find((item) => item.id === routeId);
  if (!route) return;

  const jobs = route.jobIds
    .map((jobId) => previewState.jobs.find((item) => item.id === jobId))
    .filter(Boolean);
  const coordinates = jobs
    .map((job) => {
      const location = job?.deliveryLocation || job?.pickupLocation;
      if (!location) return null;
      return [location.lng, location.lat] as [number, number];
    })
    .filter(Boolean) as [number, number][];

  route.optimizedStops = jobs.map((job, index) => {
    const location = job?.deliveryLocation || job?.pickupLocation;
    return {
      jobId: job?.id || `job-${index + 1}`,
      sequence: index + 1,
      address: job?.deliveryAddress || job?.pickupAddress || 'Address pending',
      location: location
        ? {
            latitude: location.lat,
            longitude: location.lng,
          }
        : undefined,
    };
  });
  route.routeData = {
    ...(isRecord(route.routeData) ? route.routeData : {}),
    polyline: {
      coordinates,
    },
    route: jobs.map((job, index) => {
      const location = job?.deliveryLocation || job?.pickupLocation;
      return {
        job_id: job?.id,
        sequence: index + 1,
        address: job?.deliveryAddress || job?.pickupAddress || 'Address pending',
        latitude: location?.lat,
        longitude: location?.lng,
      };
    }),
  };
  route.totalDistanceKm = Number((Math.max(route.jobIds.length, 1) * 7.6).toFixed(1));
  route.totalDurationMinutes = route.jobIds.length * 13 + (route.jobIds.length ? 10 : 0);
};

const syncPreviewRouteAssignments = () => {
  previewState.jobs.forEach((job) => {
    const route = previewState.routes.find((candidate) => candidate.jobIds.includes(job.id));
    job.assignedRouteId = route?.id || null;
  });
  previewState.routes.forEach((route) => rebuildPreviewRoute(route.id));
};

const previewRouteEditable = (routeId: string) => {
  const route = previewState.routes.find((item) => item.id === routeId);
  const status = String(route?.status || '').toLowerCase();
  return !['in_progress', 'completed', 'cancelled'].includes(status);
};

const unwrapApiPayload = (value: unknown): unknown => {
  if (!isRecord(value)) {
    return value;
  }
  return 'data' in value ? value.data : value;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

const getFirstArray = (
  value: Record<string, unknown>,
  keys: string[],
): unknown[] => {
  for (const key of keys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }
  return [];
};

const normalizeRouteRun = (value: unknown): RouteRunRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : `route-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    organizationId:
      typeof record.organizationId === 'string' ? record.organizationId : null,
    vehicleId: typeof record.vehicleId === 'string' ? record.vehicleId : null,
    driverId: typeof record.driverId === 'string' ? record.driverId : null,
    status: typeof record.status === 'string' ? record.status : 'planned',
    workflowStatus:
      typeof record.workflowStatus === 'string' ? record.workflowStatus : null,
    totalDistanceKm:
      typeof record.totalDistanceKm === 'number' ? record.totalDistanceKm : null,
    totalDurationMinutes:
      typeof record.totalDurationMinutes === 'number'
        ? record.totalDurationMinutes
        : null,
    plannedStart:
      typeof record.plannedStart === 'string' ? record.plannedStart : null,
    actualStart:
      typeof record.actualStart === 'string' ? record.actualStart : null,
    completedAt:
      typeof record.completedAt === 'string' ? record.completedAt : null,
    jobCount: typeof record.jobCount === 'number' ? record.jobCount : null,
    notes: typeof record.notes === 'string' ? record.notes : null,
    routeData: isRecord(record.routeData) ? record.routeData : null,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
};

const normalizeRouteRunStop = (value: unknown): RouteRunStopRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : `route-run-stop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    organizationId:
      typeof record.organizationId === 'string' ? record.organizationId : null,
    routeId: typeof record.routeId === 'string' ? record.routeId : '',
    jobId: typeof record.jobId === 'string' ? record.jobId : '',
    jobStopId: typeof record.jobStopId === 'string' ? record.jobStopId : '',
    stopSequence:
      typeof record.stopSequence === 'number' ? record.stopSequence : 0,
    status: typeof record.status === 'string' ? record.status : 'PENDING',
    plannedArrival:
      typeof record.plannedArrival === 'string' ? record.plannedArrival : null,
    actualArrival:
      typeof record.actualArrival === 'string' ? record.actualArrival : null,
    actualDeparture:
      typeof record.actualDeparture === 'string' ? record.actualDeparture : null,
    proofRequired:
      typeof record.proofRequired === 'boolean' ? record.proofRequired : undefined,
    notes: typeof record.notes === 'string' ? record.notes : null,
  };
};

const normalizeDispatchException = (value: unknown): DispatchExceptionRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : `exception-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    organizationId:
      typeof record.organizationId === 'string' ? record.organizationId : null,
    routeId: typeof record.routeId === 'string' ? record.routeId : null,
    routeRunStopId:
      typeof record.routeRunStopId === 'string' ? record.routeRunStopId : null,
    code: typeof record.code === 'string' ? record.code : 'UNKNOWN',
    message: typeof record.message === 'string' ? record.message : 'Unknown exception',
    status:
      record.status === 'ACKNOWLEDGED' || record.status === 'RESOLVED'
        ? record.status
        : 'OPEN',
    details: isRecord(record.details) ? record.details : undefined,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
};

const normalizeStopEvent = (value: unknown): StopEventRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : `stop-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    routeRunStopId:
      typeof record.routeRunStopId === 'string' ? record.routeRunStopId : '',
    eventType: typeof record.eventType === 'string' ? record.eventType : 'UNKNOWN',
    actorUserId:
      typeof record.actorUserId === 'string' ? record.actorUserId : null,
    payload: isRecord(record.payload) ? record.payload : undefined,
    happenedAt:
      typeof record.happenedAt === 'string' ? record.happenedAt : undefined,
  };
};

const normalizeProofArtifact = (value: unknown): ProofArtifactRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    routeRunStopId:
      typeof record.routeRunStopId === 'string' ? record.routeRunStopId : '',
    type: typeof record.type === 'string' ? record.type : 'UNKNOWN',
    uri: typeof record.uri === 'string' ? record.uri : '',
    metadata: isRecord(record.metadata) ? record.metadata : undefined,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
  };
};

const normalizeNotificationDelivery = (
  value: unknown,
): NotificationDeliveryRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    routeId: typeof record.routeId === 'string' ? record.routeId : null,
    routeRunStopId:
      typeof record.routeRunStopId === 'string' ? record.routeRunStopId : null,
    jobId: typeof record.jobId === 'string' ? record.jobId : null,
    eventType:
      typeof record.eventType === 'string' ? record.eventType : 'update',
    channel: record.channel === 'SMS' ? 'SMS' : 'EMAIL',
    recipient:
      typeof record.recipient === 'string' ? record.recipient : 'unknown',
    provider:
      typeof record.provider === 'string' ? record.provider : 'disabled',
    status:
      record.status === 'PENDING' ||
      record.status === 'FAILED' ||
      record.status === 'SKIPPED'
        ? record.status
        : 'SENT',
    subject: typeof record.subject === 'string' ? record.subject : null,
    message: typeof record.message === 'string' ? record.message : '',
    trackingUrl:
      typeof record.trackingUrl === 'string' ? record.trackingUrl : null,
    failureReason:
      typeof record.failureReason === 'string' ? record.failureReason : null,
    sentAt: typeof record.sentAt === 'string' ? record.sentAt : null,
    createdAt:
      typeof record.createdAt === 'string' ? record.createdAt : undefined,
  };
};

export async function getDispatchBoardV2(): Promise<{
  routeRuns: RouteRunRecord[];
  routeRunStops: RouteRunStopRecord[];
  exceptions: DispatchExceptionRecord[];
}> {
  if (isPreview()) {
    return {
      routeRuns: previewRouteRuns(),
      routeRunStops: previewRouteRunStops(),
      exceptions: previewExceptions(),
    };
  }
  const data = toRecord(
    unwrapApiPayload(await apiFetch<unknown>('/api/dispatch/board')),
  );
  return {
    routeRuns: getFirstArray(data, ['routes', 'routeRuns', 'items']).map(
      normalizeRouteRun,
    ),
    routeRunStops: Array.isArray(data.routeRunStops)
      ? data.routeRunStops.map(normalizeRouteRunStop)
      : [],
    exceptions: Array.isArray(data.exceptions)
      ? data.exceptions.map(normalizeDispatchException)
      : [],
  };
}

export async function listRouteRuns(): Promise<RouteRunRecord[]> {
  if (isPreview()) {
    return previewRouteRuns();
  }
  const data = toRecord(
    unwrapApiPayload(await apiFetch<unknown>('/api/route-runs')),
  );
  return getFirstArray(data, ['routeRuns', 'items']).map(normalizeRouteRun);
}

export async function getRouteRunDetail(
  routeRunId: string,
): Promise<RouteRunDetailRecord> {
  if (isPreview()) {
    return {
      routeRun:
        previewRouteRuns().find((route) => route.id === routeRunId) ||
        previewRouteRuns()[0],
      stops: previewRouteRunStops().filter((stop) => stop.routeId === routeRunId),
      exceptions: previewExceptions().filter((item) => item.routeId === routeRunId),
      stopEvents: [],
      proofArtifacts: [],
      notificationDeliveries: [],
    };
  }
  const data = toRecord(
    unwrapApiPayload(await apiFetch<unknown>(`/api/route-runs/${routeRunId}`)),
  );
  return {
    routeRun: normalizeRouteRun(data.routeRun),
    stops: getFirstArray(data, ['stops', 'items']).map(normalizeRouteRunStop),
    exceptions: Array.isArray(data.exceptions)
      ? data.exceptions.map(normalizeDispatchException)
      : [],
    stopEvents: Array.isArray(data.stopEvents)
      ? data.stopEvents.map(normalizeStopEvent)
      : [],
    proofArtifacts: Array.isArray(data.proofArtifacts)
      ? data.proofArtifacts.map(normalizeProofArtifact)
      : [],
    notificationDeliveries: Array.isArray(data.notificationDeliveries)
      ? data.notificationDeliveries.map(normalizeNotificationDelivery)
      : [],
  };
}

const reorderPreviewDispatchStops = async (
  routeId: string,
  newJobOrder: string[],
) => {
  const route = previewState.routes.find((item) => item.id === routeId);
  if (!route) {
    throw new Error(`Route ${routeId} not found`);
  }
  if (!previewRouteEditable(routeId)) {
    throw new Error('This route can no longer be reordered from dispatch.');
  }
  const unknownJobs = newJobOrder.filter((jobId) => !route.jobIds.includes(jobId));
  if (unknownJobs.length > 0) {
    throw new Error(`Unknown jobs in reorder: ${unknownJobs.join(', ')}`);
  }
  route.jobIds = newJobOrder.slice();
  syncPreviewRouteAssignments();
  return {
    route: normalizeRouteRun({
      ...route,
      totalDistanceKm: route.totalDistanceKm,
      totalDurationMinutes: route.totalDurationMinutes,
    }),
  };
};

const movePreviewDispatchStop = async (
  routeId: string,
  payload: DispatchMoveStopPayload,
) => {
  const sourceRoute = previewState.routes.find((item) => item.id === routeId);
  const targetRoute = previewState.routes.find(
    (item) => item.id === payload.targetRouteId,
  );
  if (!sourceRoute || !targetRoute) {
    throw new Error('Source or target route not found.');
  }
  if (!previewRouteEditable(routeId) || !previewRouteEditable(payload.targetRouteId)) {
    throw new Error('Only not-started routes can accept dispatch edits.');
  }
  if (!sourceRoute.jobIds.includes(payload.jobId)) {
    throw new Error('Job is not assigned to the selected source route.');
  }

  sourceRoute.jobIds = sourceRoute.jobIds.filter((jobId) => jobId !== payload.jobId);
  const targetOrder = targetRoute.jobIds.filter((jobId) => jobId !== payload.jobId);
  targetOrder.splice(Math.max(0, payload.targetSequence - 1), 0, payload.jobId);
  targetRoute.jobIds = targetOrder;
  syncPreviewRouteAssignments();

  return {
    sourceRoute: normalizeRouteRun(sourceRoute),
    targetRoute: normalizeRouteRun(targetRoute),
    optimizerHealth: {
      status: 'healthy',
      circuitOpen: false,
      consecutiveFailures: 0,
      lastCheckedAt: nowIso(),
      message: 'Preview dispatch move applied locally.',
    },
  };
};

const createPreviewException = async (payload: CreateExceptionPayload) => {
  const timestamp = nowIso();
  const exception = normalizeDispatchException({
    id: `exception-${Date.now()}`,
    organizationId: 'preview-org',
    routeId: payload.routeId || null,
    routeRunStopId: payload.routeRunStopId || null,
    code: payload.code,
    message: payload.message,
    status: 'OPEN',
    details: payload.details || {},
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  previewExceptionStore.unshift(exception);
  return { ok: true, exception };
};

const updatePreviewException = async (
  exceptionId: string,
  status: 'ACKNOWLEDGED' | 'RESOLVED',
) => {
  const exception = previewExceptionStore.find((item) => item.id === exceptionId);
  if (!exception) {
    throw new Error(`Exception ${exceptionId} not found`);
  }
  exception.status = status;
  exception.updatedAt = nowIso();
  return { ok: true, exception };
};

export const dispatchRouteRun = async (routeRunId: string) => apiFetch(`/api/route-runs/${routeRunId}/dispatch`, { method: 'POST' });
export const startRouteRun = async (routeRunId: string) => apiFetch(`/api/route-runs/${routeRunId}/start`, { method: 'POST' });
export const completeRouteRun = async (routeRunId: string) => apiFetch(`/api/route-runs/${routeRunId}/complete`, { method: 'POST' });
export const reassignRouteRun = async (routeRunId: string, payload: { driverId?: string; vehicleId?: string; reason?: string }) => apiFetch(`/api/route-runs/${routeRunId}/reassign`, {
  method: 'POST',
  body: JSON.stringify(payload),
});

export const markRouteRunStopArrived = async (stopId: string) => apiFetch(`/api/route-run-stops/${stopId}/mark-arrived`, { method: 'POST' });
export const markRouteRunStopServiced = async (stopId: string) => apiFetch(`/api/route-run-stops/${stopId}/serviced`, { method: 'POST' });
export const failRouteRunStop = async (stopId: string, reason: string) => apiFetch(`/api/route-run-stops/${stopId}/failed`, {
  method: 'POST',
  body: JSON.stringify({ reason }),
});
export const rescheduleRouteRunStop = async (stopId: string, reason: string) => apiFetch(`/api/route-run-stops/${stopId}/reschedule`, {
  method: 'POST',
  body: JSON.stringify({ reason }),
});
export const addRouteRunStopProof = async (stopId: string, payload: { type: string; uri: string; metadata?: Record<string, unknown> }) => apiFetch(`/api/route-run-stops/${stopId}/proof`, {
  method: 'POST',
  body: JSON.stringify(payload),
});
export const addRouteRunStopNote = async (stopId: string, note: string) => apiFetch(`/api/route-run-stops/${stopId}/note`, {
  method: 'POST',
  body: JSON.stringify({ note }),
});
export const getRouteRunStopTimeline = async (stopId: string): Promise<{ stop: RouteRunStopRecord; events: StopEventRecord[] }> => {
  const data = toRecord(
    unwrapApiPayload(
      await apiFetch<unknown>(`/api/route-run-stops/${stopId}/timeline`),
    ),
  );
  return {
    stop: normalizeRouteRunStop(data.stop),
    events: Array.isArray(data.events) ? data.events.map(normalizeStopEvent) : [],
  };
};
export const getRouteRunStopProofs = async (stopId: string): Promise<{ stop: RouteRunStopRecord; proofs: ProofArtifactRecord[] }> => {
  const data = toRecord(
    unwrapApiPayload(
      await apiFetch<unknown>(`/api/route-run-stops/${stopId}/proofs`),
    ),
  );
  return {
    stop: normalizeRouteRunStop(data.stop),
    proofs: Array.isArray(data.proofs) ? data.proofs.map(normalizeProofArtifact) : [],
  };
};

export const listExceptionsV2 = async (): Promise<DispatchExceptionRecord[]> => {
  if (isPreview()) {
    return previewExceptions();
  }
  const data = toRecord(
    unwrapApiPayload(await apiFetch<unknown>('/api/exceptions')),
  );
  return getFirstArray(data, ['exceptions', 'items']).map(
    normalizeDispatchException,
  );
};

export const createRouteRunShareLink = async (
  routeRunId: string,
): Promise<RouteRunShareLinkRecord> => {
  const data = toRecord(
    unwrapApiPayload(
      await apiFetch<unknown>(`/api/route-runs/${routeRunId}/share-link`, {
        method: 'POST',
      }),
    ),
  );
  return {
    token: typeof data.token === 'string' ? data.token : '',
    url: typeof data.url === 'string' ? data.url : '',
    expiresAt:
      typeof data.expiresAt === 'string'
        ? data.expiresAt
        : new Date().toISOString(),
  };
};

export const updateExceptionV2 = async (
  exceptionId: string,
  status: 'ACKNOWLEDGED' | 'RESOLVED',
) => {
  if (isPreview()) {
    return updatePreviewException(exceptionId, status);
  }
  return apiFetch(`/api/exceptions/${exceptionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
};

export const createExceptionV2 = async (
  payload: CreateExceptionPayload,
) => {
  if (isPreview()) {
    return createPreviewException(payload);
  }
  return apiFetch(`/api/exceptions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const reorderDispatchStopsV2 = async (
  routeId: string,
  newJobOrder: string[],
) => {
  if (isPreview()) {
    return reorderPreviewDispatchStops(routeId, newJobOrder);
  }
  return apiFetch(`/api/dispatch/routes/${routeId}/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ newJobOrder }),
  });
};

export const moveDispatchStopV2 = async (
  routeId: string,
  payload: DispatchMoveStopPayload,
) => {
  if (isPreview()) {
    return movePreviewDispatchStop(routeId, payload);
  }
  return apiFetch(`/api/dispatch/routes/${routeId}/move-stop`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const useDispatchBoardQuery = () =>
  useQuery({
    queryKey: queryKeys.dispatchBoard,
    queryFn: getDispatchBoardV2,
  });

export const useRouteRunsQuery = () =>
  useQuery({
    queryKey: queryKeys.routeRuns,
    queryFn: listRouteRuns,
  });

export const useRouteRunDetailQuery = (routeRunId: string) =>
  useQuery({
    queryKey: queryKeys.routeRunDetail(routeRunId),
    queryFn: () => getRouteRunDetail(routeRunId),
    enabled: Boolean(routeRunId),
  });

export const useExceptionsQuery = () =>
  useQuery({
    queryKey: queryKeys.exceptions,
    queryFn: listExceptionsV2,
  });

const invalidateRouteRunQueries = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.dispatchBoard }),
    queryClient.invalidateQueries({ queryKey: queryKeys.routeRuns }),
    queryClient.invalidateQueries({ queryKey: queryKeys.exceptions }),
    queryClient.invalidateQueries({ queryKey: queryKeys.routes }),
  ]);
};

export const useDispatchRouteRunMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dispatchRouteRun,
    onSuccess: async () => {
      await invalidateRouteRunQueries(queryClient);
    },
  });
};

export const useStartRouteRunMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startRouteRun,
    onSuccess: async (_result, routeRunId) => {
      await invalidateRouteRunQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.routeRunDetail(routeRunId),
      });
    },
  });
};

export const useCompleteRouteRunMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeRouteRun,
    onSuccess: async (_result, routeRunId) => {
      await invalidateRouteRunQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.routeRunDetail(routeRunId),
      });
    },
  });
};

export const useReassignRouteRunMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      routeRunId,
      payload,
    }: {
      routeRunId: string;
      payload: { driverId?: string; vehicleId?: string; reason?: string };
    }) => reassignRouteRun(routeRunId, payload),
    onSuccess: async (_result, variables) => {
      await invalidateRouteRunQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.routeRunDetail(variables.routeRunId),
      });
    },
  });
};

export const useRouteRunStopMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: {
      routeRunId: string;
      stopId: string;
      kind: 'arrived' | 'serviced' | 'fail' | 'reschedule' | 'note' | 'proof';
      value?: string;
    }) => {
      switch (variables.kind) {
        case 'arrived':
          return markRouteRunStopArrived(variables.stopId);
        case 'serviced':
          return markRouteRunStopServiced(variables.stopId);
        case 'fail':
          return failRouteRunStop(variables.stopId, variables.value || '');
        case 'reschedule':
          return rescheduleRouteRunStop(variables.stopId, variables.value || '');
        case 'note':
          return addRouteRunStopNote(variables.stopId, variables.value || '');
        case 'proof':
          return addRouteRunStopProof(variables.stopId, {
            type: 'PHOTO',
            uri: variables.value || '',
            metadata: { source: 'dispatcher-ui' },
          });
      }
    },
    onSuccess: async (_result, variables) => {
      await invalidateRouteRunQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.routeRunDetail(variables.routeRunId),
      });
    },
  });
};

export const useUpdateExceptionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      exceptionId,
      status,
    }: {
      exceptionId: string;
      status: 'ACKNOWLEDGED' | 'RESOLVED';
    }) => updateExceptionV2(exceptionId, status),
    onSuccess: async () => {
      await invalidateRouteRunQueries(queryClient);
    },
  });
};

export const useCreateExceptionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createExceptionV2,
    onSuccess: async () => {
      await invalidateRouteRunQueries(queryClient);
    },
  });
};

export const useReorderDispatchStopsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      routeId,
      newJobOrder,
    }: {
      routeId: string;
      newJobOrder: string[];
    }) => reorderDispatchStopsV2(routeId, newJobOrder),
    onSuccess: async (_result, variables) => {
      await invalidateRouteRunQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.routeRunDetail(variables.routeId),
      });
    },
  });
};

export const useMoveDispatchStopMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      routeId,
      payload,
    }: {
      routeId: string;
      payload: DispatchMoveStopPayload;
    }) => moveDispatchStopV2(routeId, payload),
    onSuccess: async (_result, variables) => {
      await invalidateRouteRunQueries(queryClient);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.routeRunDetail(variables.routeId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.routeRunDetail(variables.payload.targetRouteId),
        }),
      ]);
    },
  });
};

export const useRouteRunShareLinkMutation = () =>
  useMutation({
    mutationFn: createRouteRunShareLink,
  });

export const getRouteRunsErrorMessage = (error: unknown) =>
  getErrorMessage(error, 'Route run request failed.');
