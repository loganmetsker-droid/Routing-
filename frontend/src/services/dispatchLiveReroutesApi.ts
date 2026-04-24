import { apiFetch } from './api.session';
import type {
  JsonRecord,
  ReroutePreview,
  RerouteRequest,
  RouteRecord,
} from './api.types';
import { sanitizeRoute } from './dispatchShared';

export const requestRerouteLive = async (
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

export const approveRerouteLive = async (
  routeId: string,
  requestId: string,
  payload: { reviewerId?: string; reviewNote?: string } = {},
): Promise<{ rerouteRequest: RerouteRequest; route: RouteRecord }> => {
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

export const rejectRerouteLive = async (
  routeId: string,
  requestId: string,
  payload: { reviewerId?: string; reviewNote?: string } = {},
): Promise<{ rerouteRequest: RerouteRequest; route: RouteRecord }> => {
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

export const applyRerouteLive = async (
  routeId: string,
  requestId: string,
  payload: {
    appliedBy?: string;
    appliedPayload?: JsonRecord;
    overrideRequested?: boolean;
    overrideReason?: string;
    overrideActor?: string;
    overrideActorRole?: string;
  } = {},
): Promise<{ rerouteRequest: RerouteRequest; route: RouteRecord }> => {
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

export const getRerouteHistoryLive = async (
  routeId: string,
): Promise<RerouteRequest[]> => {
  try {
    const response = await apiFetch(`/api/dispatch/routes/${routeId}/reroute/history`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.rerouteRequests || [];
  } catch (error) {
    console.error('Error fetching reroute history:', error);
    return [];
  }
};

export const previewRerouteLive = async (
  routeId: string,
  payload: { action: string; payload?: JsonRecord },
): Promise<ReroutePreview | null> => {
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
