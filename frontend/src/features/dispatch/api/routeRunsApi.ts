import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiFetch,
  apiFetchResponse,
  getApiBaseUrl,
} from '../../../services/apiClient';
import {
  isPreview,
  nowIso,
  persistPreviewState,
  previewState,
} from '../../../services/api.preview';
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
  dispatchedAt?: string | null;
  dispatchedByUserId?: string | null;
  dispatchNote?: string | null;
  completedAt?: string | null;
  jobCount?: number | null;
  notes?: string | null;
  routeData?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type DispatchReadinessBlockerRecord = {
  code: string;
  message: string;
  severity: 'blocking' | string;
  routeId: string;
  exceptionId?: string | null;
};

export type DispatchReadinessRecord = {
  ready: boolean;
  blockers: DispatchReadinessBlockerRecord[];
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
  presentation?: {
    customerName?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    address?: string | null;
    location?: { latitude: number; longitude: number } | null;
    instructions?: string | null;
    timeWindowStart?: string | null;
    timeWindowEnd?: string | null;
  };
  proofRequirements?: {
    signature: 'required' | 'optional' | 'not_required';
    bol: 'required' | 'optional' | 'not_required';
    documents: 'required' | 'optional' | 'not_required';
  };
  proofStatus?: {
    proofRequired: boolean;
    proofCaptured: boolean;
    signatureCaptured: boolean;
    bolCaptured: boolean;
    documentsCaptured: boolean;
    bolSkipped: boolean;
    documentsSkipped: boolean;
    requiredProofComplete: boolean;
    proofCount: number;
    capturedCount: number;
    skippedCount: number;
    signatureProofId?: string | null;
    bolProofIds?: string[];
    documentProofIds?: string[];
  };
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

export type RouteRunMessageRecord = {
  id: string;
  organizationId?: string | null;
  routeId: string;
  routeRunStopId?: string | null;
  senderUserId?: string | null;
  senderRole: 'DRIVER' | 'DISPATCH' | string;
  body: string;
  readByDriverAt?: string | null;
  readByDispatchAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  attempts: number;
  lastAttemptAt?: string | null;
  nextAttemptAt?: string | null;
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
  messages?: RouteRunMessageRecord[];
  dispatchReadiness?: DispatchReadinessRecord | null;
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

export type DispatchRouteRunPayload = {
  note?: string;
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
    actualStart: route.status === 'in_progress' ? route.dispatchedAt || null : null,
    dispatchedAt: route.dispatchedAt || null,
    dispatchedByUserId: route.dispatchedByUserId || null,
    dispatchNote: route.dispatchNote || null,
    jobCount: route.jobIds.length,
    notes: route.planningWarnings?.join(' • ') || null,
    routeData: isRecord(route.routeData) ? route.routeData : null,
    createdAt: route.createdAt,
    updatedAt: route.createdAt,
  }));

const buildPreviewRouteRunStops = (): RouteRunStopRecord[] =>
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
      presentation: {
        customerName:
          previewState.jobs.find((job) => job.id === jobId)?.customerName ||
          `Preview customer ${index + 1}`,
        customerPhone: null,
        customerEmail: null,
        address:
          previewState.jobs.find((job) => job.id === jobId)?.deliveryAddress ||
          'Address pending',
        location: null,
        instructions: index === 0 ? 'Use the loading dock entrance.' : null,
        timeWindowStart: null,
        timeWindowEnd: null,
      },
      proofRequirements: defaultProofRequirements(index === route.jobIds.length - 1),
      proofStatus: {
        proofRequired: index === route.jobIds.length - 1,
        proofCaptured: false,
        signatureCaptured: false,
        bolCaptured: false,
        documentsCaptured: false,
        bolSkipped: false,
        documentsSkipped: false,
        requiredProofComplete: index !== route.jobIds.length - 1,
        proofCount: 0,
        capturedCount: 0,
        skippedCount: 0,
        signatureProofId: null,
        bolProofIds: [],
        documentProofIds: [],
      },
    })),
  );

const previewRouteRunStops = (): RouteRunStopRecord[] =>
  buildPreviewRouteRunStops().map(mergePreviewStopState);

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
const previewMessageStore: RouteRunMessageRecord[] = [];
const previewStopOverrides = new Map<string, Partial<RouteRunStopRecord>>();
const previewProofStore: ProofArtifactRecord[] = [];
const previewProofFileStore = new Map<string, Blob>();

const defaultProofRequirements = (proofRequired?: boolean) => ({
  signature: proofRequired ? 'required' : 'not_required',
  bol: 'optional',
  documents: 'optional',
} as const);

const previewExceptions = (): DispatchExceptionRecord[] =>
  previewExceptionStore
    .slice()
    .sort((left, right) =>
      String(right.createdAt || '').localeCompare(String(left.createdAt || '')),
    );

const previewRouteRunMessages = (routeRunId: string): RouteRunMessageRecord[] => {
  const existing = previewMessageStore.filter((message) => message.routeId === routeRunId);
  if (!existing.length) {
    previewMessageStore.push(
      normalizeRouteRunMessage({
        id: `preview-message-${routeRunId}`,
        routeId: routeRunId,
        senderRole: 'DISPATCH',
        body: 'Check in when you clear the first stop.',
        createdAt: nowIso(),
      }),
    );
  }
  return previewMessageStore
    .filter((message) => message.routeId === routeRunId)
    .slice()
    .sort((left, right) =>
      String(left.createdAt || '').localeCompare(String(right.createdAt || '')),
    );
};

const mergePreviewStopState = (stop: RouteRunStopRecord): RouteRunStopRecord => {
  const override = previewStopOverrides.get(stop.id) || {};
  const proofs = previewProofStore.filter((proof) => proof.routeRunStopId === stop.id);
  const signature = proofs.find((proof) => String(proof.type).toUpperCase() === 'SIGNATURE');
  const bolProofs = proofs.filter((proof) => String(proof.type).toUpperCase() === 'BOL');
  const documentProofs = proofs.filter((proof) => String(proof.type).toUpperCase() === 'DOCUMENT');
  const bolSkipped = proofs.some(
    (proof) =>
      String(proof.type).toUpperCase() === 'BOL_DECISION' &&
      proof.metadata?.required === false,
  );
  const documentsSkipped = proofs.some(
    (proof) =>
      String(proof.type).toUpperCase() === 'DOCUMENTS_DECISION' &&
      proof.metadata?.required === false,
  );
  const capturedProofs = proofs.filter(
    (proof) =>
      !['BOL_DECISION', 'DOCUMENTS_DECISION'].includes(
        String(proof.type).toUpperCase(),
      ),
  );
  const proofRequired = Boolean(override.proofRequired ?? stop.proofRequired);
  const proofRequirements =
    override.proofRequirements || stop.proofRequirements || defaultProofRequirements(proofRequired);
  const requiredProofComplete =
    (proofRequirements.signature !== 'required' || Boolean(signature)) &&
    (proofRequirements.bol !== 'required' || bolProofs.length > 0) &&
    (proofRequirements.documents !== 'required' || documentProofs.length > 0);
  return {
    ...stop,
    ...override,
    proofRequired,
    proofRequirements,
    proofStatus: {
      proofRequired,
      proofCaptured: capturedProofs.length > 0,
      signatureCaptured: Boolean(signature),
      bolCaptured: bolProofs.length > 0,
      documentsCaptured: documentProofs.length > 0,
      bolSkipped,
      documentsSkipped,
      requiredProofComplete,
      proofCount: capturedProofs.length,
      capturedCount: capturedProofs.length,
      skippedCount: Number(bolSkipped) + Number(documentsSkipped),
      signatureProofId: signature?.id || null,
      bolProofIds: bolProofs.map((proof) => proof.id),
      documentProofIds: documentProofs.map((proof) => proof.id),
    },
  };
};

const getPreviewStop = (stopId: string) =>
  previewRouteRunStops().find((stop) => stop.id === stopId) || null;

const updatePreviewStop = (
  stopId: string,
  patch: Partial<RouteRunStopRecord>,
) => {
  const current = getPreviewStop(stopId);
  if (!current) {
    throw new Error(`Preview stop ${stopId} not found.`);
  }
  previewStopOverrides.set(stopId, {
    ...(previewStopOverrides.get(stopId) || {}),
    ...patch,
  });
  return getPreviewStop(stopId) || current;
};

const updatePreviewRouteCompletion = (routeId: string) => {
  const route = previewState.routes.find((item) => item.id === routeId);
  if (!route) return;
  const routeStops = previewRouteRunStops().filter((stop) => stop.routeId === routeId);
  const completedStops = routeStops.filter((stop) =>
    ['SERVICED', 'FAILED', 'SKIPPED'].includes(String(stop.status).toUpperCase()),
  ).length;
  if (completedStops >= routeStops.length && routeStops.length > 0) {
    route.status = 'completed';
    route.workflowStatus = 'completed';
    route.completedAt = nowIso();
  } else if (routeStops.some((stop) => String(stop.status).toUpperCase() === 'ARRIVED')) {
    route.status = 'in_progress';
    route.workflowStatus = 'in_progress';
    route.dispatchedAt = route.dispatchedAt || nowIso();
  }
};

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

const getMutablePreviewRoute = (routeId: string) => {
  const route = previewState.routes.find((item) => item.id === routeId);
  if (!route) {
    throw new Error(`Preview route ${routeId} not found.`);
  }
  return route;
};

const previewRouteRunResult = (routeId: string) => ({
  ok: true,
  routeRun: previewRouteRuns().find((route) => route.id === routeId) || null,
});

const dispatchPreviewRouteRun = async (
  routeId: string,
  payload: DispatchRouteRunPayload = {},
) => {
  const route = getMutablePreviewRoute(routeId);
  const timestamp = nowIso();
  route.status = 'assigned';
  route.workflowStatus = 'ready_for_dispatch';
  route.dispatchedAt = route.dispatchedAt || timestamp;
  route.dispatchedByUserId = 'preview-user';
  route.dispatchNote = payload.note?.trim() || null;
  if (route.dispatchNote) {
    previewMessageStore.push(
      normalizeRouteRunMessage({
        id: `preview-dispatch-message-${Date.now()}`,
        organizationId: 'preview-org',
        routeId,
        senderRole: 'DISPATCH',
        body: route.dispatchNote,
        readByDispatchAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );
  }
  persistPreviewState();
  return previewRouteRunResult(routeId);
};

const startPreviewRouteRun = async (routeId: string) => {
  const route = getMutablePreviewRoute(routeId);
  const timestamp = nowIso();
  route.status = 'in_progress';
  route.workflowStatus = 'in_progress';
  route.dispatchedAt = route.dispatchedAt || timestamp;
  persistPreviewState();
  return previewRouteRunResult(routeId);
};

const completePreviewRouteRun = async (routeId: string) => {
  const route = getMutablePreviewRoute(routeId);
  const timestamp = nowIso();
  route.status = 'completed';
  route.workflowStatus = 'completed';
  route.completedAt = route.completedAt || timestamp;
  persistPreviewState();
  return previewRouteRunResult(routeId);
};

const reassignPreviewRouteRun = async (
  routeId: string,
  payload: { driverId?: string; vehicleId?: string; reason?: string },
) => {
  const route = getMutablePreviewRoute(routeId);
  if ('driverId' in payload) {
    route.driverId = payload.driverId || undefined;
    if (!payload.vehicleId && route.driverId) {
      const driver = previewState.drivers.find((item) => item.id === route.driverId);
      route.vehicleId = driver?.currentVehicleId || driver?.assignedVehicleId || route.vehicleId;
    }
  }
  if (typeof payload.vehicleId === 'string' && payload.vehicleId) {
    route.vehicleId = payload.vehicleId;
  }
  route.updatedAt = nowIso();
  persistPreviewState();
  return previewRouteRunResult(routeId);
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
    dispatchedAt:
      typeof record.dispatchedAt === 'string' ? record.dispatchedAt : null,
    dispatchedByUserId:
      typeof record.dispatchedByUserId === 'string' ? record.dispatchedByUserId : null,
    dispatchNote:
      typeof record.dispatchNote === 'string' ? record.dispatchNote : null,
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
  const presentation = isRecord(record.presentation) ? record.presentation : {};
  const location = isRecord(presentation.location) ? presentation.location : null;
  const proofRequirements = isRecord(record.proofRequirements)
    ? record.proofRequirements
    : {};
  const proofStatus = isRecord(record.proofStatus) ? record.proofStatus : {};
  const proofRequired = Boolean(proofStatus.proofRequired ?? record.proofRequired);
  const normalizedProofRequirements = {
    signature:
      proofRequirements.signature === 'required' ||
      proofRequirements.signature === 'optional' ||
      proofRequirements.signature === 'not_required'
        ? proofRequirements.signature
        : proofRequired
          ? 'required'
          : 'not_required',
    bol:
      proofRequirements.bol === 'required' ||
      proofRequirements.bol === 'optional' ||
      proofRequirements.bol === 'not_required'
        ? proofRequirements.bol
        : 'optional',
    documents:
      proofRequirements.documents === 'required' ||
      proofRequirements.documents === 'optional' ||
      proofRequirements.documents === 'not_required'
        ? proofRequirements.documents
        : 'optional',
  } as RouteRunStopRecord['proofRequirements'];
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
    presentation: {
      customerName:
        typeof presentation.customerName === 'string'
          ? presentation.customerName
          : null,
      customerPhone:
        typeof presentation.customerPhone === 'string'
          ? presentation.customerPhone
          : null,
      customerEmail:
        typeof presentation.customerEmail === 'string'
          ? presentation.customerEmail
          : null,
      address:
        typeof presentation.address === 'string'
          ? presentation.address
          : null,
      location: location
        ? {
            latitude: Number(location.latitude || 0),
            longitude: Number(location.longitude || 0),
          }
        : null,
      instructions:
        typeof presentation.instructions === 'string'
          ? presentation.instructions
          : null,
      timeWindowStart:
        typeof presentation.timeWindowStart === 'string'
          ? presentation.timeWindowStart
          : null,
      timeWindowEnd:
        typeof presentation.timeWindowEnd === 'string'
          ? presentation.timeWindowEnd
          : null,
    },
    proofRequirements: normalizedProofRequirements,
    proofStatus: {
      proofRequired,
      proofCaptured: Boolean(proofStatus.proofCaptured),
      signatureCaptured: Boolean(proofStatus.signatureCaptured),
      bolCaptured: Boolean(proofStatus.bolCaptured),
      documentsCaptured: Boolean(proofStatus.documentsCaptured),
      bolSkipped: Boolean(proofStatus.bolSkipped),
      documentsSkipped: Boolean(proofStatus.documentsSkipped),
      requiredProofComplete: Boolean(
        proofStatus.requiredProofComplete ??
          (!proofRequired || proofStatus.signatureCaptured),
      ),
      proofCount: Number(proofStatus.proofCount || 0),
      capturedCount: Number(proofStatus.capturedCount ?? proofStatus.proofCount ?? 0),
      skippedCount: Number(proofStatus.skippedCount || 0),
      signatureProofId:
        typeof proofStatus.signatureProofId === 'string'
          ? proofStatus.signatureProofId
          : null,
      bolProofIds: Array.isArray(proofStatus.bolProofIds)
        ? proofStatus.bolProofIds.filter((item): item is string => typeof item === 'string')
        : [],
      documentProofIds: Array.isArray(proofStatus.documentProofIds)
        ? proofStatus.documentProofIds.filter((item): item is string => typeof item === 'string')
        : [],
    },
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

const normalizeRouteRunMessage = (value: unknown): RouteRunMessageRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    organizationId:
      typeof record.organizationId === 'string' ? record.organizationId : null,
    routeId: typeof record.routeId === 'string' ? record.routeId : '',
    routeRunStopId:
      typeof record.routeRunStopId === 'string' ? record.routeRunStopId : null,
    senderUserId:
      typeof record.senderUserId === 'string' ? record.senderUserId : null,
    senderRole:
      typeof record.senderRole === 'string' ? record.senderRole : 'DISPATCH',
    body: typeof record.body === 'string' ? record.body : '',
    readByDriverAt:
      typeof record.readByDriverAt === 'string' ? record.readByDriverAt : null,
    readByDispatchAt:
      typeof record.readByDispatchAt === 'string'
        ? record.readByDispatchAt
        : null,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
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
    attempts:
      typeof record.attempts === 'number' && Number.isFinite(record.attempts)
        ? record.attempts
        : 0,
    lastAttemptAt:
      typeof record.lastAttemptAt === 'string' ? record.lastAttemptAt : null,
    nextAttemptAt:
      typeof record.nextAttemptAt === 'string' ? record.nextAttemptAt : null,
    sentAt: typeof record.sentAt === 'string' ? record.sentAt : null,
    createdAt:
      typeof record.createdAt === 'string' ? record.createdAt : undefined,
  };
};

const normalizeDispatchReadiness = (value: unknown): DispatchReadinessRecord | null => {
  const record = isRecord(value) ? value : null;
  if (!record) return null;
  const blockers = Array.isArray(record.blockers)
    ? record.blockers
        .filter(isRecord)
        .map((blocker) => ({
          code: typeof blocker.code === 'string' ? blocker.code : 'UNKNOWN',
          message:
            typeof blocker.message === 'string'
              ? blocker.message
              : 'Dispatch blocker requires review.',
          severity:
            typeof blocker.severity === 'string' ? blocker.severity : 'blocking',
          routeId: typeof blocker.routeId === 'string' ? blocker.routeId : '',
          exceptionId:
            typeof blocker.exceptionId === 'string' ? blocker.exceptionId : null,
        }))
    : [];

  return {
    ready: Boolean(record.ready) && blockers.length === 0,
    blockers,
  };
};

export async function getDispatchBoardV2(): Promise<{
  routeRuns: RouteRunRecord[];
  routeRunStops: RouteRunStopRecord[];
  exceptions: DispatchExceptionRecord[];
  dispatchReadiness: Record<string, DispatchReadinessRecord>;
}> {
  if (isPreview()) {
    return {
      routeRuns: previewRouteRuns(),
      routeRunStops: previewRouteRunStops(),
      exceptions: previewExceptions(),
      dispatchReadiness: {},
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
    dispatchReadiness: isRecord(data.dispatchReadiness)
      ? Object.fromEntries(
          Object.entries(data.dispatchReadiness)
            .map(([routeId, readiness]) => [
              routeId,
              normalizeDispatchReadiness(readiness),
            ])
            .filter((entry): entry is [string, DispatchReadinessRecord] =>
              Boolean(entry[1]),
            ),
        )
      : {},
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
      proofArtifacts: previewProofStore.filter((proof) =>
        previewRouteRunStops().some(
          (stop) => stop.routeId === routeRunId && stop.id === proof.routeRunStopId,
        ),
      ),
      notificationDeliveries: [],
      messages: previewRouteRunMessages(routeRunId),
      dispatchReadiness: null,
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
    messages: Array.isArray(data.messages)
      ? data.messages.map(normalizeRouteRunMessage)
      : [],
    dispatchReadiness: normalizeDispatchReadiness(data.dispatchReadiness),
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
  persistPreviewState();
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
  persistPreviewState();

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

export const dispatchRouteRun = async (
  routeRunId: string,
  payload: DispatchRouteRunPayload = {},
) => {
  if (isPreview()) {
    return dispatchPreviewRouteRun(routeRunId, payload);
  }
  return apiFetch(`/api/route-runs/${routeRunId}/dispatch`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const startRouteRun = async (routeRunId: string) => {
  if (isPreview()) {
    return startPreviewRouteRun(routeRunId);
  }
  return apiFetch(`/api/route-runs/${routeRunId}/start`, { method: 'POST' });
};

export const completeRouteRun = async (routeRunId: string) => {
  if (isPreview()) {
    return completePreviewRouteRun(routeRunId);
  }
  return apiFetch(`/api/route-runs/${routeRunId}/complete`, { method: 'POST' });
};

export const reassignRouteRun = async (
  routeRunId: string,
  payload: { driverId?: string; vehicleId?: string; reason?: string },
) => {
  if (isPreview()) {
    return reassignPreviewRouteRun(routeRunId, payload);
  }
  return apiFetch(`/api/route-runs/${routeRunId}/reassign`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const markRouteRunStopArrived = async (stopId: string) => {
  if (isPreview()) {
    const timestamp = nowIso();
    const current = getPreviewStop(stopId);
    const stop = updatePreviewStop(stopId, {
      status: 'ARRIVED',
      actualArrival: current?.actualArrival || timestamp,
    });
    updatePreviewRouteCompletion(stop.routeId);
    return { ok: true, stop };
  }
  return apiFetch(`/api/route-run-stops/${stopId}/mark-arrived`, { method: 'POST' });
};

export const markRouteRunStopServiced = async (stopId: string) => {
  if (isPreview()) {
    const current = getPreviewStop(stopId);
    if (!current) {
      throw new Error(`Preview stop ${stopId} not found.`);
    }
    const requiresProof = Boolean(current.proofStatus?.proofRequired || current.proofRequired);
    const hasSignature =
      Boolean(current.proofStatus?.signatureCaptured) ||
      previewProofStore.some(
        (proof) =>
          proof.routeRunStopId === stopId &&
          String(proof.type).toUpperCase() === 'SIGNATURE',
      );
    if (requiresProof && !hasSignature) {
      throw new Error('Signature proof is required before departing this stop.');
    }
    const timestamp = nowIso();
    const stop = updatePreviewStop(stopId, {
      status: 'SERVICED',
      actualArrival: current.actualArrival || timestamp,
      actualDeparture: timestamp,
    });
    updatePreviewRouteCompletion(stop.routeId);
    return { ok: true, stop };
  }
  return apiFetch(`/api/route-run-stops/${stopId}/serviced`, { method: 'POST' });
};
export const failRouteRunStop = async (stopId: string, reason: string) => {
  if (isPreview()) {
    const stop = updatePreviewStop(stopId, {
      status: 'FAILED',
      notes: reason,
      actualDeparture: nowIso(),
    });
    updatePreviewRouteCompletion(stop.routeId);
    return { ok: true, stop };
  }
  return apiFetch(`/api/route-run-stops/${stopId}/failed`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
};

export const rescheduleRouteRunStop = async (stopId: string, reason: string) => {
  if (isPreview()) {
    const stop = updatePreviewStop(stopId, {
      status: 'RESCHEDULED',
      notes: reason,
    });
    updatePreviewRouteCompletion(stop.routeId);
    return { ok: true, stop };
  }
  return apiFetch(`/api/route-run-stops/${stopId}/reschedule`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
};
export const addRouteRunStopProof = async (
  stopId: string,
  payload: { type: string; uri: string; metadata?: Record<string, unknown> },
) => {
  if (isPreview()) {
    const current = getPreviewStop(stopId);
    if (!current) {
      throw new Error(`Preview stop ${stopId} not found.`);
    }
    const type = String(payload.type || '').toUpperCase();
    if (type === 'SIGNATURE') {
      const signerName =
        typeof payload.metadata?.signerName === 'string'
          ? payload.metadata.signerName.trim()
          : '';
      if (!signerName) {
        throw new Error('Signer name is required for signature proof.');
      }
    }
    const proof = normalizeProofArtifact({
      id: `preview-proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      routeRunStopId: stopId,
      type,
      uri: type === 'SIGNATURE' ? 'inline-signature' : payload.uri,
      metadata: payload.metadata || {},
      createdAt: nowIso(),
    });
    previewProofStore.push(proof);
    updatePreviewStop(stopId, {});
    return { ok: true, proof };
  }
  return apiFetch(`/api/route-run-stops/${stopId}/proof`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const addRouteRunStopProofFile = async (
  stopId: string,
  payload: {
    type: 'BOL' | 'DOCUMENT';
    file: File;
    metadata?: Record<string, unknown>;
  },
) => {
  if (isPreview()) {
    const current = getPreviewStop(stopId);
    if (!current) {
      throw new Error(`Preview stop ${stopId} not found.`);
    }
    const type = String(payload.type || '').toUpperCase();
    const proof = normalizeProofArtifact({
      id: `preview-proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      routeRunStopId: stopId,
      type,
      uri: `preview-file://${payload.file.name}`,
      metadata: {
        ...(payload.metadata || {}),
        originalName: payload.file.name,
        mimeType: payload.file.type || 'application/octet-stream',
        size: payload.file.size,
        capturedAt: nowIso(),
        source: 'driver-pwa',
      },
      createdAt: nowIso(),
    });
    previewProofStore.push(proof);
    previewProofFileStore.set(proof.id, payload.file);
    updatePreviewStop(stopId, {});
    return { ok: true, proof };
  }

  const formData = new FormData();
  formData.set('type', payload.type);
  formData.set('file', payload.file);
  if (payload.metadata) {
    formData.set('metadata', JSON.stringify(payload.metadata));
  }
  const data = toRecord(
    unwrapApiPayload(
      await apiFetch<unknown>(`/api/route-run-stops/${stopId}/proof-file`, {
        method: 'POST',
        body: formData,
      }),
    ),
  );
  return {
    ok: true,
    proof: normalizeProofArtifact(data.proof),
  };
};

export const recordRouteRunStopProofDecision = async (
  stopId: string,
  payload: { type: 'BOL' | 'DOCUMENTS'; required: false; reason?: string },
) => {
  if (isPreview()) {
    const current = getPreviewStop(stopId);
    if (!current) {
      throw new Error(`Preview stop ${stopId} not found.`);
    }
    const proof = normalizeProofArtifact({
      id: `preview-proof-decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      routeRunStopId: stopId,
      type: payload.type === 'BOL' ? 'BOL_DECISION' : 'DOCUMENTS_DECISION',
      uri: 'proof-decision',
      metadata: {
        required: false,
        reason: payload.reason || null,
        capturedAt: nowIso(),
        source: 'driver-pwa',
      },
      createdAt: nowIso(),
    });
    previewProofStore.push(proof);
    updatePreviewStop(stopId, {});
    return { ok: true, proof };
  }

  const data = toRecord(
    unwrapApiPayload(
      await apiFetch<unknown>(`/api/route-run-stops/${stopId}/proof-decision`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    ),
  );
  return {
    ok: true,
    proof: normalizeProofArtifact(data.proof),
  };
};

export const getProofArtifactDownloadUrl = (proofId: string) =>
  `${getApiBaseUrl()}/api/proof-artifacts/${proofId}/download`;

export const fetchProofArtifactBlob = async (proofId: string) => {
  if (isPreview()) {
    const proof = previewProofStore.find((item) => item.id === proofId);
    if (!proof) {
      throw new Error(`Preview proof ${proofId} not found.`);
    }
    const storedFile = previewProofFileStore.get(proofId);
    if (storedFile) {
      return {
        blob: storedFile,
        contentType: storedFile.type || 'application/octet-stream',
        filename:
          typeof proof.metadata?.originalName === 'string'
            ? proof.metadata.originalName
            : `proof-${proofId}`,
      };
    }
    return {
      blob: new Blob([proof.uri || 'Proof captured in preview mode.'], { type: 'text/plain' }),
      contentType: 'text/plain',
      filename: `proof-${proofId}.txt`,
    };
  }
  const response = await apiFetchResponse(`/api/proof-artifacts/${proofId}/download`);
  return {
    blob: await response.blob(),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    filename:
      response.headers
        .get('content-disposition')
        ?.match(/filename="([^"]+)"/)?.[1] || 'proof-file',
  };
};

export const addRouteRunStopNote = async (stopId: string, note: string) => {
  if (isPreview()) {
    const stop = updatePreviewStop(stopId, { notes: note });
    return { ok: true, stop };
  }
  return apiFetch(`/api/route-run-stops/${stopId}/note`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
};

export const listRouteRunMessages = async (
  routeRunId: string,
): Promise<{ messages: RouteRunMessageRecord[]; unreadCount: number }> => {
  if (isPreview()) {
    const messages = previewRouteRunMessages(routeRunId);
    return {
      messages,
      unreadCount: messages.filter(
        (message) => message.senderRole !== 'DRIVER' && !message.readByDriverAt,
      ).length,
    };
  }
  const data = toRecord(
    unwrapApiPayload(
      await apiFetch<unknown>(`/api/route-runs/${routeRunId}/messages`),
    ),
  );
  const messages = Array.isArray(data.messages)
    ? data.messages.map(normalizeRouteRunMessage)
    : [];
  return {
    messages,
    unreadCount: Number(data.unreadCount || 0),
  };
};

export const createRouteRunMessage = async (
  routeRunId: string,
  payload: { body: string; routeRunStopId?: string | null },
): Promise<RouteRunMessageRecord> => {
  if (isPreview()) {
    const message = normalizeRouteRunMessage({
      id: `preview-message-${Date.now()}`,
      routeId: routeRunId,
      routeRunStopId: payload.routeRunStopId || null,
      senderRole: 'DISPATCH',
      body: payload.body,
      readByDriverAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    previewMessageStore.push(message);
    return message;
  }
  const data = toRecord(
    unwrapApiPayload(
      await apiFetch<unknown>(`/api/route-runs/${routeRunId}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    ),
  );
  return normalizeRouteRunMessage(data.message);
};

export const markRouteRunMessagesRead = async (
  routeRunId: string,
): Promise<{ messages: RouteRunMessageRecord[]; unreadCount: number }> => {
  if (isPreview()) {
    previewMessageStore
      .filter((message) => message.routeId === routeRunId && message.senderRole !== 'DRIVER')
      .forEach((message) => {
        message.readByDriverAt = message.readByDriverAt || nowIso();
      });
    return listRouteRunMessages(routeRunId);
  }
  const data = toRecord(
    unwrapApiPayload(
      await apiFetch<unknown>(`/api/route-runs/${routeRunId}/messages/read`, {
        method: 'POST',
      }),
    ),
  );
  return {
    messages: Array.isArray(data.messages)
      ? data.messages.map(normalizeRouteRunMessage)
      : [],
    unreadCount: Number(data.unreadCount || 0),
  };
};

export const getRouteRunStopTimeline = async (stopId: string): Promise<{ stop: RouteRunStopRecord; events: StopEventRecord[] }> => {
  if (isPreview()) {
    const stop = getPreviewStop(stopId);
    if (!stop) {
      throw new Error(`Preview stop ${stopId} not found.`);
    }
    const events: StopEventRecord[] = [
      stop.actualArrival
        ? normalizeStopEvent({
            id: `preview-event-${stopId}-arrived`,
            routeRunStopId: stopId,
            eventType: 'ARRIVED',
            happenedAt: stop.actualArrival,
          })
        : null,
      stop.actualDeparture
        ? normalizeStopEvent({
            id: `preview-event-${stopId}-departed`,
            routeRunStopId: stopId,
            eventType: 'SERVICED',
            happenedAt: stop.actualDeparture,
          })
        : null,
      ...previewProofStore
        .filter((proof) => proof.routeRunStopId === stopId)
        .map((proof) =>
          normalizeStopEvent({
            id: `preview-event-${proof.id}`,
            routeRunStopId: stopId,
            eventType: 'PROOF_CAPTURED',
            payload: { proofType: proof.type },
            happenedAt: proof.createdAt,
          }),
        ),
    ].filter(Boolean) as StopEventRecord[];
    return { stop, events };
  }
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
  if (isPreview()) {
    const stop = getPreviewStop(stopId);
    if (!stop) {
      throw new Error(`Preview stop ${stopId} not found.`);
    }
    return {
      stop,
      proofs: previewProofStore.filter((proof) => proof.routeRunStopId === stopId),
    };
  }
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
  if (isPreview()) {
    const token = `preview-${routeRunId}`;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return {
      token,
      url: `${origin}/track/${encodeURIComponent(token)}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
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

export const useRouteRunMessagesQuery = (routeRunId: string) =>
  useQuery({
    queryKey: queryKeys.routeRunMessages(routeRunId),
    queryFn: () => listRouteRunMessages(routeRunId),
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
    mutationFn: (
      variables:
        | string
        | { routeRunId: string; payload?: DispatchRouteRunPayload },
    ) =>
      typeof variables === 'string'
        ? dispatchRouteRun(variables)
        : dispatchRouteRun(variables.routeRunId, variables.payload),
    onSuccess: async (_result, variables) => {
      await invalidateRouteRunQueries(queryClient);
      const routeRunId = typeof variables === 'string' ? variables : variables.routeRunId;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.routeRunMessages(routeRunId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.routeRunDetail(routeRunId),
      });
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
      kind:
        | 'arrived'
        | 'serviced'
        | 'fail'
        | 'reschedule'
        | 'note'
        | 'proof'
        | 'proofFile'
        | 'proofDecision';
      value?: string;
      proof?: { type: string; uri: string; metadata?: Record<string, unknown> };
      proofFile?: {
        type: 'BOL' | 'DOCUMENT';
        file: File;
        metadata?: Record<string, unknown>;
      };
      proofDecision?: {
        type: 'BOL' | 'DOCUMENTS';
        required: false;
        reason?: string;
      };
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
          return addRouteRunStopProof(
            variables.stopId,
            variables.proof || {
              type: 'PHOTO',
              uri: variables.value || '',
              metadata: { source: 'dispatcher-ui' },
            },
          );
        case 'proofFile':
          if (!variables.proofFile) {
            throw new Error('Proof file payload is required.');
          }
          return addRouteRunStopProofFile(variables.stopId, variables.proofFile);
        case 'proofDecision':
          if (!variables.proofDecision) {
            throw new Error('Proof decision payload is required.');
          }
          return recordRouteRunStopProofDecision(
            variables.stopId,
            variables.proofDecision,
          );
      }
    },
    onSuccess: async (_result, variables) => {
      await invalidateRouteRunQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.routeRunDetail(variables.routeRunId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.driverManifest,
      });
    },
  });
};

export const useCreateRouteRunMessageMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      routeRunId,
      payload,
    }: {
      routeRunId: string;
      payload: { body: string; routeRunStopId?: string | null };
    }) => createRouteRunMessage(routeRunId, payload),
    onSuccess: async (result, variables) => {
      queryClient.setQueryData<{ messages: RouteRunMessageRecord[]; unreadCount: number }>(
        queryKeys.routeRunMessages(variables.routeRunId),
        (current) => ({
          messages: [
            ...(current?.messages || []).filter((message) => message.id !== result.id),
            result,
          ],
          unreadCount: current?.unreadCount || 0,
        }),
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.routeRunMessages(variables.routeRunId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.routeRunDetail(variables.routeRunId),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.driverManifest });
    },
  });
};

export const useMarkRouteRunMessagesReadMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markRouteRunMessagesRead,
    onSuccess: async (_result, routeRunId) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.routeRunMessages(routeRunId),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.driverManifest });
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
    onSuccess: async (_result, variables) => {
      await invalidateRouteRunQueries(queryClient);
      if (variables.routeId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.routeRunDetail(variables.routeId),
        });
      }
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
