import { getApiBaseUrl } from './apiClient';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api.session';
import {
  buildPreviewTrackingSnapshot,
  isPreview,
  nowIso,
} from './api.preview';
import { getTrackingSocket } from './socket';
import type {
  JsonRecord,
  TrackingLocationsSnapshot,
  TrackingReadiness,
  TrackingStatistics,
  TrackingVehicleLocation,
} from './api.types';
import { isRecord } from './api.types';
import { queryKeys } from './queryKeys';

const API_BASE_URL = getApiBaseUrl();

const normalizeTrackingLocation = (
  location: unknown,
): TrackingVehicleLocation | null => {
  const value = isRecord(location) ? location : {};
  const nestedLocation = isRecord(value.location) ? value.location : {};
  const latitude = Number(
    value.latitude ?? value.lat ?? nestedLocation.lat ?? nestedLocation.latitude,
  );
  const longitude = Number(
    value.longitude ?? value.lng ?? nestedLocation.lng ?? nestedLocation.longitude,
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    vehicleId: String(value.vehicleId ?? value.id ?? ''),
    latitude,
    longitude,
    speed: Number.isFinite(Number(value.speed)) ? Number(value.speed) : undefined,
    heading: Number.isFinite(Number(value.heading))
      ? Number(value.heading)
      : undefined,
    timestamp: String(value.timestamp ?? nowIso()),
    vehicleInfo:
      isRecord(value.vehicleInfo) ||
      value.licensePlate ||
      value.make ||
      value.model
        ? {
            licensePlate:
              typeof value.licensePlate === 'string'
                ? value.licensePlate
                : undefined,
            make: typeof value.make === 'string' ? value.make : undefined,
            model: typeof value.model === 'string' ? value.model : undefined,
            status: typeof value.status === 'string' ? value.status : undefined,
            vehicleType:
              typeof value.vehicleType === 'string'
                ? value.vehicleType
                : undefined,
            ...(isRecord(value.vehicleInfo) ? value.vehicleInfo : {}),
          }
        : undefined,
  };
};

const normalizeTrackingSnapshot = (
  payload: unknown,
): TrackingLocationsSnapshot => {
  const data = isRecord(payload)
    ? isRecord(payload.data)
      ? payload.data
      : payload
    : {};
  const rawVehicles = Array.isArray(data)
    ? data
    : Array.isArray(data.vehicles)
      ? data.vehicles
      : [];
  const vehicles = rawVehicles
    .map(normalizeTrackingLocation)
    .filter(
      (item: TrackingVehicleLocation | null): item is TrackingVehicleLocation =>
        Boolean(item),
    );

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

    const handleEvent = (payload: JsonRecord) =>
      finish(((payload.data ?? payload) as T) || fallback);
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
  const handleSnapshot = (payload: unknown) => {
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
    return buildPreviewTrackingSnapshot().vehicles.filter(
      (item) => item.vehicleId === vehicleId,
    );
  }

  const response = await apiFetch(`/api/tracking/history/${vehicleId}?hours=${hours}`);
  const payload = await response.json();

  return Array.isArray(payload.history)
    ? payload.history
        .map(normalizeTrackingLocation)
        .filter(
          (item: TrackingVehicleLocation | null): item is TrackingVehicleLocation =>
            Boolean(item),
        )
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

export const useTrackingLocationsQuery = () =>
  useQuery({
    queryKey: queryKeys.trackingOverview,
    queryFn: getTrackingLocations,
  });

export const useTrackingReadinessQuery = () =>
  useQuery({
    queryKey: queryKeys.trackingReadiness,
    queryFn: getTrackingReadiness,
  });

export const useTrackingStatisticsQuery = () =>
  useQuery({
    queryKey: queryKeys.trackingStatistics,
    queryFn: getTrackingStatistics,
  });

export const connectSSE = (
  onMessage: (data: unknown) => void,
): EventSource => {
  const eventSource = new EventSource(`${API_BASE_URL}/stream-route`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as unknown;
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
