import { apiFetch } from '../../../services/apiClient';

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

export async function getDispatchBoardV2(): Promise<{
  routeRuns: RouteRunRecord[];
  routeRunStops: RouteRunStopRecord[];
  exceptions: DispatchExceptionRecord[];
}> {
  const response = await apiFetch<any>('/api/dispatch/board');
  const data = response?.data || response;
  return {
    routeRuns: data.routes || data.routeRuns || data.items || [],
    routeRunStops: data.routeRunStops || [],
    exceptions: data.exceptions || [],
  };
}

export async function listRouteRuns(): Promise<RouteRunRecord[]> {
  const response = await apiFetch<any>('/api/route-runs');
  const data = response?.data || response;
  return data.routeRuns || data.items || [];
}

export async function getRouteRunDetail(routeRunId: string): Promise<{
  routeRun: RouteRunRecord;
  stops: RouteRunStopRecord[];
  exceptions: DispatchExceptionRecord[];
  stopEvents: StopEventRecord[];
  proofArtifacts: ProofArtifactRecord[];
}> {
  const response = await apiFetch<any>(`/api/route-runs/${routeRunId}`);
  const data = response?.data || response;
  return {
    routeRun: data.routeRun,
    stops: data.stops || data.items || [],
    exceptions: data.exceptions || [],
    stopEvents: data.stopEvents || [],
    proofArtifacts: data.proofArtifacts || [],
  };
}

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
  const response = await apiFetch<any>(`/api/route-run-stops/${stopId}/timeline`);
  return response?.data || response;
};
export const getRouteRunStopProofs = async (stopId: string): Promise<{ stop: RouteRunStopRecord; proofs: ProofArtifactRecord[] }> => {
  const response = await apiFetch<any>(`/api/route-run-stops/${stopId}/proofs`);
  return response?.data || response;
};

export const listExceptionsV2 = async (): Promise<DispatchExceptionRecord[]> => {
  const response = await apiFetch<any>('/api/exceptions');
  const data = response?.data || response;
  return data.exceptions || data.items || [];
};

export const updateExceptionV2 = async (exceptionId: string, status: 'ACKNOWLEDGED' | 'RESOLVED') => apiFetch(`/api/exceptions/${exceptionId}`, {
  method: 'PATCH',
  body: JSON.stringify({ status }),
});
