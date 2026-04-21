import type {
  DispatchTimelineEvent,
  OptimizerHealth,
  RerouteRequest,
} from '../../../services/api';
import {
  assignDriverToRoute,
  createRouteVersionSnapshot,
  getDispatchOptimizerHealth,
  getDispatchTimeline,
  getDrivers,
  getJobs,
  getRerouteHistory,
  getRoutes,
  getVehicles,
  listRouteVersions,
  publishRouteVersion,
  reviewRouteVersion,
  approveRouteVersion,
  startRoute,
} from '../../../services/api';
import type {
  DispatchDriver,
  DispatchJob,
  DispatchRoute,
  DispatchVehicle,
} from '../../../types/dispatch';
import type { DispatchRouteVersion } from '../types/dispatch';

export async function getDispatchBoardData(): Promise<{
  jobs: DispatchJob[];
  routes: DispatchRoute[];
  vehicles: DispatchVehicle[];
  drivers: DispatchDriver[];
  optimizerHealth: OptimizerHealth | null;
  timeline: DispatchTimelineEvent[];
}> {
  const [jobs, routes, vehicles, drivers, optimizerHealth, timeline] = await Promise.all([
    getJobs(),
    getRoutes(),
    getVehicles(),
    getDrivers(),
    getDispatchOptimizerHealth(),
    getDispatchTimeline({ limit: 25 }),
  ]);

  return {
    jobs: jobs as DispatchJob[],
    routes: routes as DispatchRoute[],
    vehicles: vehicles as DispatchVehicle[],
    drivers: drivers as DispatchDriver[],
    optimizerHealth,
    timeline,
  };
}

export function getRouteVersions(routeId: string): Promise<DispatchRouteVersion[]> {
  return listRouteVersions(routeId) as Promise<DispatchRouteVersion[]>;
}

export function snapshotRoute(routeId: string): Promise<DispatchRouteVersion> {
  return createRouteVersionSnapshot(routeId) as Promise<DispatchRouteVersion>;
}

export function markRouteReviewed(routeId: string, versionId: string): Promise<DispatchRouteVersion> {
  return reviewRouteVersion(routeId, versionId) as Promise<DispatchRouteVersion>;
}

export function markRouteApproved(routeId: string, versionId: string): Promise<DispatchRouteVersion> {
  return approveRouteVersion(routeId, versionId) as Promise<DispatchRouteVersion>;
}

export function publishRoute(routeId: string, versionId: string): Promise<DispatchRouteVersion> {
  return publishRouteVersion(routeId, versionId) as Promise<DispatchRouteVersion>;
}

export function assignRouteDriver(routeId: string, driverId: string) {
  return assignDriverToRoute(routeId, driverId);
}

export function beginRoute(routeId: string) {
  return startRoute(routeId);
}

export function getRouteAuditTrail(routeId: string): Promise<RerouteRequest[]> {
  return getRerouteHistory(routeId);
}
