import { unwrapApiData } from '@shared/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, getSession, isAuthBypassed } from './api.session';
import {
  type DriverManifestRecord,
  type DriverManifestRouteRecord,
  isRecord,
} from './api.types';
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
        : `driver-stop-${Math.random().toString(36).slice(2, 8)}`,
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

const normalizeManifestRoute = (value: unknown): DriverManifestRouteRecord => {
  const record = isRecord(value) ? value : {};
  const routeRun = isRecord(record.routeRun) ? record.routeRun : {};
  const progress = isRecord(record.progress) ? record.progress : {};
  const vehicle = isRecord(record.vehicle) ? record.vehicle : null;
  const latestTelemetry = isRecord(record.latestTelemetry)
    ? record.latestTelemetry
    : null;

  return {
    routeRun: {
      id:
        typeof routeRun.id === 'string'
          ? routeRun.id
          : `driver-route-${Math.random().toString(36).slice(2, 8)}`,
      status: typeof routeRun.status === 'string' ? routeRun.status : 'planned',
      workflowStatus:
        typeof routeRun.workflowStatus === 'string'
          ? routeRun.workflowStatus
          : null,
      plannedStart:
        typeof routeRun.plannedStart === 'string' ? routeRun.plannedStart : null,
      completedAt:
        typeof routeRun.completedAt === 'string' ? routeRun.completedAt : null,
      totalDistanceKm:
        typeof routeRun.totalDistanceKm === 'number'
          ? routeRun.totalDistanceKm
          : null,
      totalDurationMinutes:
        typeof routeRun.totalDurationMinutes === 'number'
          ? routeRun.totalDurationMinutes
          : null,
      vehicleId:
        typeof routeRun.vehicleId === 'string' ? routeRun.vehicleId : null,
    },
    stops: Array.isArray(record.stops) ? record.stops.map(normalizeStop) : [],
    vehicle: vehicle
      ? {
          id: typeof vehicle.id === 'string' ? vehicle.id : 'vehicle-unknown',
          make: typeof vehicle.make === 'string' ? vehicle.make : 'Vehicle',
          model: typeof vehicle.model === 'string' ? vehicle.model : 'Unknown',
          licensePlate:
            typeof vehicle.licensePlate === 'string'
              ? vehicle.licensePlate
              : 'Pending',
          status:
            typeof vehicle.status === 'string' ? vehicle.status : undefined,
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
    progress: {
      totalStops:
        typeof progress.totalStops === 'number'
          ? progress.totalStops
          : Number(progress.totalStops || 0),
      completedStops:
        typeof progress.completedStops === 'number'
          ? progress.completedStops
          : Number(progress.completedStops || 0),
      remainingStops:
        typeof progress.remainingStops === 'number'
          ? progress.remainingStops
          : Number(progress.remainingStops || 0),
      nextStopId:
        typeof progress.nextStopId === 'string' ? progress.nextStopId : null,
    },
  };
};

const buildPreviewManifest = async (): Promise<DriverManifestRecord> => {
  const session = await getSession().catch(() => ({
    user: {
      email: 'preview@trovan.local',
      role: 'dispatcher',
      roles: ['DISPATCHER'],
      id: 'preview-user',
    },
  }));
  const sessionEmail = session.user.email?.toLowerCase?.() ?? '';
  const preferredDriver =
    previewState.drivers.find((driver) =>
      `${driver.firstName}.${driver.lastName}@trovan.local`
        .toLowerCase()
        .includes(sessionEmail.split('@')[0] || ''),
    ) ?? previewState.drivers[0];
  const routes = previewState.routes.filter(
    (route) => route.driverId === preferredDriver?.id,
  );

  return {
    generatedAt: new Date().toISOString(),
    driver: {
      id: preferredDriver?.id || 'preview-driver',
      firstName: preferredDriver?.firstName || 'Preview',
      lastName: preferredDriver?.lastName || 'Driver',
      email: `${preferredDriver?.firstName || 'preview'}.${preferredDriver?.lastName || 'driver'}@trovan.local`
        .toLowerCase(),
      phone: '(555) 010-2121',
      currentVehicleId: routes[0]?.vehicleId || null,
    },
    routes: routes.map((route) => {
      const coordinate = getPreviewTrackingCoordinate(route);
      const vehicle = previewState.vehicles.find(
        (candidate) => candidate.id === route.vehicleId,
      );
      const stops = (route.optimizedStops || []).map((_stop, index) => ({
        id: `${route.id}-stop-${index + 1}`,
        stopSequence: index + 1,
        status:
          index === 0 && route.status === 'in_progress' ? 'ARRIVED' : 'PENDING',
        plannedArrival: null,
        actualArrival:
          index === 0 && route.status === 'in_progress'
            ? new Date().toISOString()
            : null,
        actualDeparture: null,
        notes: null,
      }));

      return {
        routeRun: {
          id: route.id,
          status: String(route.status),
          workflowStatus: route.workflowStatus || null,
          plannedStart: route.dispatchedAt || route.createdAt || null,
          completedAt: route.completedAt || null,
          totalDistanceKm: route.totalDistanceKm || null,
          totalDurationMinutes: route.totalDurationMinutes || null,
          vehicleId: route.vehicleId || null,
        },
        stops,
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
              speed: 18,
              heading: 92,
              timestamp: new Date().toISOString(),
            }
          : null,
        progress: {
          totalStops: stops.length,
          completedStops: 0,
          remainingStops: stops.length,
          nextStopId: stops[0]?.id || null,
        },
      };
    }),
  };
};

export const getDriverManifest = async (): Promise<DriverManifestRecord> => {
  if (isPreview() || isAuthBypassed()) {
    return buildPreviewManifest();
  }

  const response = await apiFetch('/api/driver/manifest');
  const data = unwrapApiData<{ ok?: boolean } & Record<string, unknown>>(
    await response.json(),
  );
  const driver = isRecord(data.driver) ? data.driver : {};

  return {
    generatedAt:
      typeof data.generatedAt === 'string'
        ? data.generatedAt
        : new Date().toISOString(),
    driver: {
      id: typeof driver.id === 'string' ? driver.id : 'driver-unknown',
      firstName:
        typeof driver.firstName === 'string' ? driver.firstName : 'Driver',
      lastName:
        typeof driver.lastName === 'string' ? driver.lastName : 'Unknown',
      email: typeof driver.email === 'string' ? driver.email : '',
      phone: typeof driver.phone === 'string' ? driver.phone : '',
      currentVehicleId:
        typeof driver.currentVehicleId === 'string'
          ? driver.currentVehicleId
          : null,
    },
    routes: Array.isArray(data.routes)
      ? data.routes.map(normalizeManifestRoute)
      : [],
  };
};

export const useDriverManifestQuery = () =>
  useQuery({
    queryKey: queryKeys.driverManifest,
    queryFn: getDriverManifest,
  });
