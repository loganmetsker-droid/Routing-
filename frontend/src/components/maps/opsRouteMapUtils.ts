import { trovanRoutePalette } from './mapPresentation';
import type { DriverRecord, JsonRecord, RouteRecord, VehicleRecord } from '../../services/api.types';
import type {
  DispatchExceptionRecord,
  RouteRunRecord,
  RouteRunStopRecord,
} from '../../features/dispatch/api/routeRunsApi';

type MapLocation = { lat: number; lng: number };

type MultiRouteMapRoute = {
  id: string;
  color: string;
  status: string;
  jobCount: number;
  totalDistanceKm?: number;
  totalDurationMinutes?: number;
  eta?: string;
  polyline?: { coordinates: [number, number][] } | null;
  vehicle?: {
    id: string;
    make: string;
    model: string;
    licensePlate: string;
    currentLocation?: { lat: number; lng: number };
  };
  driver?: {
    firstName: string;
    lastName: string;
  };
  stops?: Array<{
    lat: number;
    lng: number;
    address: string;
    type: 'pickup' | 'delivery';
  }>;
};

const asRecord = (value: unknown): JsonRecord | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;

const getNumeric = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getLocation = (value: unknown): MapLocation | null => {
  const record = asRecord(value);
  if (!record) return null;
  const latitude =
    getNumeric(record.latitude) ??
    getNumeric(record.lat);
  const longitude =
    getNumeric(record.longitude) ??
    getNumeric(record.lng);
  if (latitude === null || longitude === null) return null;
  return { lat: latitude, lng: longitude };
};

const getPolylineCoordinates = (value: unknown): [number, number][] | null => {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.coordinates)) return null;
  const coordinates = record.coordinates
    .map((item) => (Array.isArray(item) && item.length >= 2 ? item : null))
    .filter((item): item is [number, number] => Boolean(item))
    .map(([lng, lat]) => [Number(lng), Number(lat)] as [number, number])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  return coordinates.length >= 2 ? coordinates : null;
};

const mapStopsFromRoute = (route: RouteRecord) =>
  (route.optimizedStops || [])
    .map((stop, index) => {
      const location = getLocation(stop.location);
      if (!location) return null;
      return {
        lat: location.lat,
        lng: location.lng,
        address: stop.address || `Stop ${index + 1}`,
        type: index === 0 ? 'pickup' : 'delivery' as const,
      };
    })
    .filter(Boolean) as MultiRouteMapRoute['stops'];

export const buildMapRoutesFromRoutes = (
  routes: RouteRecord[],
  vehicles: VehicleRecord[],
  drivers: DriverRecord[],
): MultiRouteMapRoute[] =>
  routes.map((route, index) => {
    const vehicle = vehicles.find((item) => item.id === route.vehicleId);
    const driver = drivers.find((item) => item.id === route.driverId);
    const routeData = asRecord(route.routeData);
    const polyline =
      getPolylineCoordinates(route.polyline) ||
      getPolylineCoordinates(routeData?.polyline);

    return {
      id: route.id,
      color: trovanRoutePalette[index % trovanRoutePalette.length],
      status: route.status || 'planned',
      jobCount: route.jobIds?.length || route.optimizedStops?.length || 0,
      totalDistanceKm: route.totalDistanceKm ?? route.totalDistance ?? undefined,
      totalDurationMinutes:
        route.totalDurationMinutes ?? route.totalDuration ?? undefined,
      eta: route.eta || undefined,
      polyline: polyline ? { coordinates: polyline } : null,
      vehicle: vehicle
        ? {
            id: vehicle.id,
            make: vehicle.make || 'Vehicle',
            model: vehicle.model || '',
            licensePlate: vehicle.licensePlate || vehicle.id,
          }
        : undefined,
      driver: driver
        ? {
            firstName: driver.firstName || '',
            lastName: driver.lastName || '',
          }
        : undefined,
      stops: mapStopsFromRoute(route),
    };
  });

export const buildMapRoutesFromRouteRuns = (
  routeRuns: RouteRunRecord[],
  routeRunStops: RouteRunStopRecord[],
  vehicles: VehicleRecord[],
  drivers: DriverRecord[],
): MultiRouteMapRoute[] =>
  routeRuns.map((route, index) => {
    const vehicle = vehicles.find((item) => item.id === route.vehicleId);
    const driver = drivers.find((item) => item.id === route.driverId);
    const routeData = asRecord(route.routeData);
    const routeEntries = Array.isArray(routeData?.route) ? routeData.route : [];
    const polyline =
      getPolylineCoordinates(routeData?.polyline);

    const stops = routeRunStops
      .filter((stop) => stop.routeId === route.id)
      .sort((left, right) => left.stopSequence - right.stopSequence)
      .map((stop) => {
        const details = asRecord(
          routeEntries.find((entry) => {
            const record = asRecord(entry);
            return record?.job_id === stop.jobId || record?.jobId === stop.jobId;
          }),
        );
        const location = getLocation(details);
        if (!location) return null;
        return {
          lat: location.lat,
          lng: location.lng,
          address: typeof details?.address === 'string' ? details.address : stop.jobId,
          type: stop.stopSequence === 1 ? 'pickup' : 'delivery' as const,
        };
      })
      .filter(Boolean) as MultiRouteMapRoute['stops'];

    return {
      id: route.id,
      color: trovanRoutePalette[index % trovanRoutePalette.length],
      status: route.status || 'planned',
      jobCount: route.jobCount || routeRunStops.filter((stop) => stop.routeId === route.id).length,
      totalDistanceKm: route.totalDistanceKm ?? undefined,
      totalDurationMinutes: route.totalDurationMinutes ?? undefined,
      eta: undefined,
      polyline: polyline ? { coordinates: polyline } : null,
      vehicle: vehicle
        ? {
            id: vehicle.id,
            make: vehicle.make || 'Vehicle',
            model: vehicle.model || '',
            licensePlate: vehicle.licensePlate || vehicle.id,
          }
        : undefined,
      driver: driver
        ? {
            firstName: driver.firstName || '',
            lastName: driver.lastName || '',
          }
        : undefined,
      stops,
    };
  });

export const countOpenExceptions = (
  exceptions: DispatchExceptionRecord[],
  routeId?: string,
) =>
  exceptions.filter((item) => item.status === 'OPEN' && (!routeId || item.routeId === routeId))
    .length;
