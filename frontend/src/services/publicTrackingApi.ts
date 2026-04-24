import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from './apiClient';
import { type PublicTrackingRecord, isRecord } from './api.types';
import {
  getPreviewTrackingCoordinate,
  isPreview,
  previewState,
} from './api.preview';
import { queryKeys } from './queryKeys';

const normalizeStop = (value: unknown) => {
  const record = isRecord(value) ? value : {};
  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : `public-stop-${Math.random().toString(36).slice(2, 8)}`,
    stopSequence:
      typeof record.stopSequence === 'number' ? record.stopSequence : 0,
    status: typeof record.status === 'string' ? record.status : 'PENDING',
    plannedArrival:
      typeof record.plannedArrival === 'string' ? record.plannedArrival : null,
    actualArrival:
      typeof record.actualArrival === 'string' ? record.actualArrival : null,
    actualDeparture:
      typeof record.actualDeparture === 'string' ? record.actualDeparture : null,
    notes: typeof record.notes === 'string' ? record.notes : null,
  };
};

const normalizePublicTracking = (value: unknown): PublicTrackingRecord => {
  const record = isRecord(value) ? value : {};
  const organization = isRecord(record.organization) ? record.organization : {};
  const branding =
    isRecord(organization.branding) ? organization.branding : {};
  const routeRun = isRecord(record.routeRun) ? record.routeRun : {};
  const vehicle = isRecord(record.vehicle) ? record.vehicle : null;
  const latestTelemetry = isRecord(record.latestTelemetry)
    ? record.latestTelemetry
    : null;

  return {
    organization: {
      id:
        typeof organization.id === 'string'
          ? organization.id
          : 'organization-public',
      name:
        typeof organization.name === 'string'
          ? organization.name
          : 'Trovan Logistics',
      slug: typeof organization.slug === 'string' ? organization.slug : 'trovan',
      branding: {
        brandName:
          typeof branding.brandName === 'string' ? branding.brandName : undefined,
        primaryColor:
          typeof branding.primaryColor === 'string'
            ? branding.primaryColor
            : undefined,
        accentColor:
          typeof branding.accentColor === 'string'
            ? branding.accentColor
            : undefined,
        supportEmail:
          typeof branding.supportEmail === 'string'
            ? branding.supportEmail
            : undefined,
        supportPhone:
          typeof branding.supportPhone === 'string'
            ? branding.supportPhone
            : undefined,
        trackingHeadline:
          typeof branding.trackingHeadline === 'string'
            ? branding.trackingHeadline
            : undefined,
        trackingSubtitle:
          typeof branding.trackingSubtitle === 'string'
            ? branding.trackingSubtitle
            : undefined,
      },
    },
    routeRun: {
      id: typeof routeRun.id === 'string' ? routeRun.id : 'route-public',
      status: typeof routeRun.status === 'string' ? routeRun.status : 'planned',
      workflowStatus:
        typeof routeRun.workflowStatus === 'string'
          ? routeRun.workflowStatus
          : null,
      plannedStart:
        typeof routeRun.plannedStart === 'string' ? routeRun.plannedStart : null,
      actualStart:
        typeof routeRun.actualStart === 'string' ? routeRun.actualStart : null,
      completedAt:
        typeof routeRun.completedAt === 'string' ? routeRun.completedAt : null,
      eta: typeof routeRun.eta === 'string' ? routeRun.eta : null,
      jobCount:
        typeof routeRun.jobCount === 'number' ? routeRun.jobCount : null,
      vehicleId:
        typeof routeRun.vehicleId === 'string' ? routeRun.vehicleId : null,
    },
    stops: Array.isArray(record.stops) ? record.stops.map(normalizeStop) : [],
    vehicle: vehicle
      ? {
          id: typeof vehicle.id === 'string' ? vehicle.id : 'vehicle-public',
          make: typeof vehicle.make === 'string' ? vehicle.make : 'Vehicle',
          model: typeof vehicle.model === 'string' ? vehicle.model : 'Unknown',
          licensePlate:
            typeof vehicle.licensePlate === 'string'
              ? vehicle.licensePlate
              : 'Pending',
          status: typeof vehicle.status === 'string' ? vehicle.status : undefined,
        }
      : null,
    latestTelemetry: latestTelemetry
      ? {
          latitude: Number(latestTelemetry.latitude || 0),
          longitude: Number(latestTelemetry.longitude || 0),
          speed:
            latestTelemetry.speed !== undefined
              ? Number(latestTelemetry.speed)
              : null,
          heading:
            latestTelemetry.heading !== undefined
              ? Number(latestTelemetry.heading)
              : null,
          timestamp:
            typeof latestTelemetry.timestamp === 'string'
              ? latestTelemetry.timestamp
              : new Date().toISOString(),
        }
      : null,
    expiresAt:
      typeof record.expiresAt === 'string'
        ? record.expiresAt
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
};

const getPreviewPublicTracking = (token: string): PublicTrackingRecord => {
  const route =
    previewState.routes.find((candidate) => candidate.id === token) ||
    previewState.routes[0];
  const vehicle = previewState.vehicles.find(
    (candidate) => candidate.id === route?.vehicleId,
  );
  const coordinate = route ? getPreviewTrackingCoordinate(route) : null;

  return {
    organization: {
      id: 'preview-org',
      name: 'Trovan Local Preview',
      slug: 'trovan-preview',
      branding: {
        brandName: 'Trovan Local Preview',
        primaryColor: '#1F1A17',
        accentColor: '#C87441',
        supportEmail: 'dispatch@trovan.local',
        supportPhone: '(555) 010-2026',
        trackingHeadline: 'Your order is on the move',
        trackingSubtitle:
          'Live route execution, stop progress, and delivery visibility from the preview environment.',
      },
    },
    routeRun: {
      id: route?.id || 'preview-route',
      status: route?.status || 'planned',
      workflowStatus: route?.workflowStatus || null,
      plannedStart: route?.createdAt || null,
      actualStart: route?.dispatchedAt || null,
      completedAt: route?.completedAt || null,
      eta: null,
      jobCount: route?.jobIds?.length || 0,
      vehicleId: route?.vehicleId || null,
    },
    stops: (route?.optimizedStops || []).map((_stop, index) => ({
      id: `${route?.id}-public-stop-${index + 1}`,
      stopSequence: index + 1,
      status:
        index === 0 && route?.status === 'in_progress' ? 'ARRIVED' : 'PENDING',
      plannedArrival: null,
      actualArrival:
        index === 0 && route?.status === 'in_progress'
          ? new Date().toISOString()
          : null,
      actualDeparture: null,
      notes: null,
    })),
    vehicle: vehicle
      ? {
          id: vehicle.id,
          make: vehicle.make || 'Vehicle',
          model: vehicle.model || 'Unknown',
          licensePlate: vehicle.licensePlate || 'Pending',
          status: vehicle.status,
        }
      : null,
    latestTelemetry: coordinate
      ? {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          speed: 21,
          heading: 84,
          timestamp: new Date().toISOString(),
        }
      : null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
};

export const getPublicTracking = async (
  token: string,
): Promise<PublicTrackingRecord> => {
  if (isPreview()) {
    return getPreviewPublicTracking(token);
  }

  const response = await fetch(
    `${getApiBaseUrl()}/api/public/tracking/${encodeURIComponent(token)}`,
    {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Tracking link unavailable (${response.status})`);
  }
  const payload = await response.json();
  return normalizePublicTracking(
    isRecord(payload) && 'data' in payload ? payload.data : payload,
  );
};

export const usePublicTrackingQuery = (token: string) =>
  useQuery({
    queryKey: queryKeys.publicTracking(token),
    queryFn: () => getPublicTracking(token),
    enabled: Boolean(token),
  });
