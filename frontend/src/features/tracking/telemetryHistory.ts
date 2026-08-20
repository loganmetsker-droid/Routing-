import type { RouteRecord, TrackingVehicleLocation } from '../../services/api.types';

export const TELEMETRY_LIVE_MS = 2 * 60 * 1000;
export const TELEMETRY_DELAYED_MS = 10 * 60 * 1000;

export type TelemetryFreshness = 'live' | 'delayed' | 'stale' | 'unavailable';

const validCoordinate = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

export function getTelemetryFreshness(
  timestamp: string | undefined,
  nowMs = Date.now(),
): TelemetryFreshness {
  if (!timestamp) return 'unavailable';
  const timestampMs = new Date(timestamp).getTime();
  if (!Number.isFinite(timestampMs)) return 'unavailable';
  const ageMs = Math.max(0, nowMs - timestampMs);
  if (ageMs <= TELEMETRY_LIVE_MS) return 'live';
  if (ageMs <= TELEMETRY_DELAYED_MS) return 'delayed';
  return 'stale';
}

export function formatTelemetryAge(
  timestamp: string | undefined,
  nowMs = Date.now(),
) {
  if (!timestamp) return 'No timestamp';
  const timestampMs = new Date(timestamp).getTime();
  if (!Number.isFinite(timestampMs)) return 'Timestamp unavailable';
  const ageSeconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (ageSeconds < 15) return 'Just now';
  if (ageSeconds < 60) return `${ageSeconds}s ago`;
  const ageMinutes = Math.floor(ageSeconds / 60);
  if (ageMinutes < 60) return `${ageMinutes}m ago`;
  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) return `${ageHours}h ago`;
  return `${Math.floor(ageHours / 24)}d ago`;
}

export function prepareTelemetryHistory(
  points: TrackingVehicleLocation[],
  vehicleId?: string,
) {
  const seen = new Set<string>();
  return points
    .filter((point) => !vehicleId || point.vehicleId === vehicleId)
    .filter((point) => validCoordinate(point.latitude, point.longitude))
    .filter((point) => Number.isFinite(new Date(point.timestamp).getTime()))
    .filter((point) => {
      const key = `${point.timestamp}:${point.latitude}:${point.longitude}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (left, right) =>
        new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    );
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function calculateTelemetryDistanceKm(points: TrackingVehicleLocation[]) {
  let totalKm = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const latitudeDelta = radians(current.latitude - previous.latitude);
    const longitudeDelta = radians(current.longitude - previous.longitude);
    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(radians(previous.latitude)) *
        Math.cos(radians(current.latitude)) *
        Math.sin(longitudeDelta / 2) ** 2;
    totalKm += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return totalKm;
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export function getPlannedRoutePositions(route?: RouteRecord | null) {
  if (!route) return [] as Array<[number, number]>;
  const routeData = record(route.routeData);
  const polyline = record(route.polyline) || record(routeData?.polyline);
  if (Array.isArray(polyline?.coordinates)) {
    const coordinates = polyline.coordinates
      .map((point) => {
        if (!Array.isArray(point) || point.length < 2) return null;
        const longitude = Number(point[0]);
        const latitude = Number(point[1]);
        return validCoordinate(latitude, longitude)
          ? ([latitude, longitude] as [number, number])
          : null;
      })
      .filter((point): point is [number, number] => Boolean(point));
    if (coordinates.length >= 2) return coordinates;
  }

  return (route.optimizedStops || [])
    .map((stop) => {
      const latitude = Number(stop.location?.latitude);
      const longitude = Number(stop.location?.longitude);
      return validCoordinate(latitude, longitude)
        ? ([latitude, longitude] as [number, number])
        : null;
    })
    .filter((point): point is [number, number] => Boolean(point));
}
