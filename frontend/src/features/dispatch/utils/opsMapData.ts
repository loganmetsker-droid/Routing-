import type {
  DriverRecord,
  PlannerRoutePlanGroup,
  PlannerRoutePlanStop,
  RouteRecord,
  VehicleRecord,
} from '../../../services/api.types';
import { trovanRoutePalette } from '../../../components/maps/mapPresentation';

type OpsJobRecord = {
  id: string;
  customerName?: string;
  deliveryAddress?: string;
  pickupAddress?: string;
  deliveryLocation?: { lat?: number; lng?: number } | null;
  pickupLocation?: { lat?: number; lng?: number } | null;
};

export type OpsMapRoute = {
  id: string;
  color: string;
  polyline?: { coordinates?: [number, number][] } | null;
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
  status: string;
  totalDistanceKm?: number;
  totalDurationMinutes?: number;
  eta?: string;
  jobCount: number;
  stops?: Array<{
    lat: number;
    lng: number;
    address: string;
    type: 'pickup' | 'delivery';
  }>;
};

const extractJobLocation = (job?: OpsJobRecord | null) => {
  const raw = job?.deliveryLocation || job?.pickupLocation;
  if (!raw) return null;
  if (typeof raw.lat !== 'number' || typeof raw.lng !== 'number') {
    return null;
  }
  return raw;
};

const routeColor = (index: number) =>
  trovanRoutePalette[index % trovanRoutePalette.length];

const extractRoutePolyline = (route: RouteRecord) => {
  const routeData =
    route.routeData && typeof route.routeData === 'object' ? route.routeData : {};
  const rawPolyline =
    route.polyline && typeof route.polyline === 'object'
      ? route.polyline
      : routeData && typeof routeData.polyline === 'object'
        ? routeData.polyline
        : null;
  if (
    !rawPolyline ||
    !Array.isArray((rawPolyline as { coordinates?: unknown }).coordinates)
  ) {
    return [];
  }
  return (rawPolyline as { coordinates: unknown[] }).coordinates
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const [lng, lat] = point;
      if (typeof lat !== 'number' || typeof lng !== 'number') return null;
      return [lng, lat] as [number, number];
    })
    .filter(Boolean) as [number, number][];
};

export const buildDispatchMapRoutes = ({
  routes,
  jobs,
  drivers,
  vehicles,
}: {
  routes: RouteRecord[];
  jobs: OpsJobRecord[];
  drivers: DriverRecord[];
  vehicles: VehicleRecord[];
}): OpsMapRoute[] => {
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  return routes.map((route, index) => {
    const polyline = extractRoutePolyline(route);
    const stops = (
      route.jobIds?.map((jobId) => {
        const job = jobById.get(jobId);
        const location = extractJobLocation(job);
        if (!location) return null;
        return {
          lat: location.lat,
          lng: location.lng,
          address: job?.deliveryAddress || job?.pickupAddress || 'Address pending',
          type: 'delivery' as const,
        };
      }).filter(Boolean) || []
    ) as OpsMapRoute['stops'];
    const vehicle = route.vehicleId ? vehicleById.get(route.vehicleId) : null;
    const driver = route.driverId ? driverById.get(route.driverId) : null;
    const currentLocation =
      stops && stops[0]
        ? { lat: stops[0].lat, lng: stops[0].lng }
        : undefined;

    return {
      id: route.id,
      color: route.color || routeColor(index),
      polyline: polyline.length ? { coordinates: polyline } : null,
      vehicle: vehicle
        ? {
            id: vehicle.id,
            make: vehicle.make || 'Vehicle',
            model: vehicle.model || '',
            licensePlate: vehicle.licensePlate || vehicle.id,
            currentLocation,
          }
        : undefined,
      driver: driver
        ? {
            firstName: driver.firstName || 'Driver',
            lastName: driver.lastName || '',
          }
        : undefined,
      status: String(route.workflowStatus || route.status || 'planned'),
      totalDistanceKm: Number(route.totalDistanceKm || route.totalDistance || 0),
      totalDurationMinutes: Number(
        route.totalDurationMinutes || route.totalDuration || 0,
      ),
      eta: route.eta || undefined,
      jobCount: route.jobIds?.length || 0,
      stops,
    };
  });
};

export const buildPlannerMapRoutes = ({
  groups,
  stops,
  jobs,
  drivers,
  vehicles,
}: {
  groups: PlannerRoutePlanGroup[];
  stops: PlannerRoutePlanStop[];
  jobs: OpsJobRecord[];
  drivers: DriverRecord[];
  vehicles: VehicleRecord[];
}): OpsMapRoute[] => {
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  return groups.map((group, index) => {
    const groupStops = stops
      .filter((stop) => stop.routePlanGroupId === group.id)
      .sort((left, right) => left.stopSequence - right.stopSequence);
    const points = groupStops
      .map((stop) => extractJobLocation(jobById.get(stop.jobId)))
      .filter(Boolean) as Array<{ lat: number; lng: number }>;
    const vehicle = group.vehicleId ? vehicleById.get(group.vehicleId) : null;
    const driver = group.driverId ? driverById.get(group.driverId) : null;

    return {
      id: group.id,
      color: routeColor(index),
      polyline: points.length
        ? {
            coordinates: points.map((point) => [point.lng, point.lat] as [number, number]),
          }
        : null,
      vehicle: vehicle
        ? {
            id: vehicle.id,
            make: vehicle.make || 'Vehicle',
            model: vehicle.model || '',
            licensePlate: vehicle.licensePlate || vehicle.id,
            currentLocation: points[0]
              ? { lat: points[0].lat, lng: points[0].lng }
              : undefined,
          }
        : undefined,
      driver: driver
        ? {
            firstName: driver.firstName || 'Driver',
            lastName: driver.lastName || '',
          }
        : undefined,
      status: 'draft',
      totalDistanceKm: Number(group.totalDistanceKm || 0),
      totalDurationMinutes: Number(group.totalDurationMinutes || 0),
      jobCount: groupStops.length,
      stops: groupStops
        .map((stop) => {
          const job = jobById.get(stop.jobId);
          const location = extractJobLocation(job);
          if (!location) return null;
          return {
            lat: location.lat,
            lng: location.lng,
            address:
              String(stop.metadata?.address || '') ||
              job?.deliveryAddress ||
              'Address pending',
            type: 'delivery' as const,
          };
        })
        .filter(Boolean) as OpsMapRoute['stops'],
    };
  });
};
