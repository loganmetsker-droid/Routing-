import { unwrapApiData } from '@shared/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api.session';
import {
  type AnalyticsOverviewRecord,
  isRecord,
} from './api.types';
import { buildPreviewTrackingSnapshot, isPreview, previewState } from './api.preview';
import { queryKeys } from './queryKeys';

const normalizeBreakdown = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((item) => {
          const record = isRecord(item) ? item : {};
          return {
            status:
              typeof record.status === 'string' ? record.status : 'unknown',
            count:
              typeof record.count === 'number'
                ? record.count
                : Number(record.count || 0),
          };
        })
        .filter((item) => Number.isFinite(item.count))
    : [];

const defaultOverview = (): AnalyticsOverviewRecord => ({
  generatedAt: new Date().toISOString(),
  serviceLevel: {
    onTimeRate: 0,
    proofCaptureRate: 0,
    exceptionRate: 0,
    completedRouteRunsLast7Days: 0,
  },
  operations: {
    totalRouteRuns: 0,
    activeRouteRuns: 0,
    plannedRouteRuns: 0,
    averageRouteDistanceKm: 0,
    averageRouteDurationMinutes: 0,
  },
  fleet: {
    totalVehicles: 0,
    activeVehicles: 0,
    vehiclesReportingRecently: 0,
    totalDrivers: 0,
    activeDrivers: 0,
  },
  workload: {
    totalStops: 0,
    servicedStops: 0,
    openExceptions: 0,
  },
  routeStatusBreakdown: [],
  exceptionStatusBreakdown: [],
});

const getPreviewAnalyticsOverview = (): AnalyticsOverviewRecord => {
  const totalRoutes = previewState.routes.length;
  const activeRoutes = previewState.routes.filter((route) =>
    ['assigned', 'in_progress'].includes(String(route.status)),
  ).length;
  const plannedRoutes = previewState.routes.filter(
    (route) => String(route.status) === 'planned',
  ).length;
  const averageRouteDistanceKm =
    totalRoutes > 0
      ? Number(
          (
            previewState.routes.reduce(
              (sum, route) => sum + Number(route.totalDistanceKm || 0),
              0,
            ) / totalRoutes
          ).toFixed(1),
        )
      : 0;
  const averageRouteDurationMinutes =
    totalRoutes > 0
      ? Number(
          (
            previewState.routes.reduce(
              (sum, route) => sum + Number(route.totalDurationMinutes || 0),
              0,
            ) / totalRoutes
          ).toFixed(1),
        )
      : 0;

  const tracking = buildPreviewTrackingSnapshot();

  return {
    generatedAt: new Date().toISOString(),
    serviceLevel: {
      onTimeRate: 94.5,
      proofCaptureRate: 88.2,
      exceptionRate: totalRoutes ? Number(((1 / totalRoutes) * 100).toFixed(1)) : 0,
      completedRouteRunsLast7Days: previewState.routes.filter(
        (route) => route.status === 'completed',
      ).length,
    },
    operations: {
      totalRouteRuns: totalRoutes,
      activeRouteRuns: activeRoutes,
      plannedRouteRuns: plannedRoutes,
      averageRouteDistanceKm,
      averageRouteDurationMinutes,
    },
    fleet: {
      totalVehicles: previewState.vehicles.length,
      activeVehicles: previewState.vehicles.filter((vehicle) =>
        ['available', 'in_use', 'active'].includes(String(vehicle.status)),
      ).length,
      vehiclesReportingRecently: tracking.count,
      totalDrivers: previewState.drivers.length,
      activeDrivers: previewState.drivers.filter((driver) =>
        ['active', 'on_duty', 'on_route'].includes(String(driver.status)),
      ).length,
    },
    workload: {
      totalStops: previewState.routes.reduce(
        (sum, route) => sum + (route.optimizedStops?.length || 0),
        0,
      ),
      servicedStops: 1,
      openExceptions: previewState.routes.filter((route) =>
        Array.isArray(route.planningWarnings) && route.planningWarnings.length > 0,
      ).length,
    },
    routeStatusBreakdown: ['planned', 'assigned', 'in_progress', 'completed'].map(
      (status) => ({
        status,
        count: previewState.routes.filter((route) => route.status === status).length,
      }),
    ),
    exceptionStatusBreakdown: [
      {
        status: 'OPEN',
        count: previewState.routes.filter(
          (route) => (route.planningWarnings?.length || 0) > 0,
        ).length,
      },
      { status: 'RESOLVED', count: 0 },
    ],
  };
};

const normalizeOverview = (value: unknown): AnalyticsOverviewRecord => {
  const record = isRecord(value) ? value : {};
  const serviceLevel = isRecord(record.serviceLevel) ? record.serviceLevel : {};
  const operations = isRecord(record.operations) ? record.operations : {};
  const fleet = isRecord(record.fleet) ? record.fleet : {};
  const workload = isRecord(record.workload) ? record.workload : {};
  const fallback = defaultOverview();

  return {
    generatedAt:
      typeof record.generatedAt === 'string'
        ? record.generatedAt
        : fallback.generatedAt,
    serviceLevel: {
      onTimeRate:
        typeof serviceLevel.onTimeRate === 'number'
          ? serviceLevel.onTimeRate
          : Number(serviceLevel.onTimeRate || 0),
      proofCaptureRate:
        typeof serviceLevel.proofCaptureRate === 'number'
          ? serviceLevel.proofCaptureRate
          : Number(serviceLevel.proofCaptureRate || 0),
      exceptionRate:
        typeof serviceLevel.exceptionRate === 'number'
          ? serviceLevel.exceptionRate
          : Number(serviceLevel.exceptionRate || 0),
      completedRouteRunsLast7Days:
        typeof serviceLevel.completedRouteRunsLast7Days === 'number'
          ? serviceLevel.completedRouteRunsLast7Days
          : Number(serviceLevel.completedRouteRunsLast7Days || 0),
    },
    operations: {
      totalRouteRuns:
        typeof operations.totalRouteRuns === 'number'
          ? operations.totalRouteRuns
          : Number(operations.totalRouteRuns || 0),
      activeRouteRuns:
        typeof operations.activeRouteRuns === 'number'
          ? operations.activeRouteRuns
          : Number(operations.activeRouteRuns || 0),
      plannedRouteRuns:
        typeof operations.plannedRouteRuns === 'number'
          ? operations.plannedRouteRuns
          : Number(operations.plannedRouteRuns || 0),
      averageRouteDistanceKm:
        typeof operations.averageRouteDistanceKm === 'number'
          ? operations.averageRouteDistanceKm
          : Number(operations.averageRouteDistanceKm || 0),
      averageRouteDurationMinutes:
        typeof operations.averageRouteDurationMinutes === 'number'
          ? operations.averageRouteDurationMinutes
          : Number(operations.averageRouteDurationMinutes || 0),
    },
    fleet: {
      totalVehicles:
        typeof fleet.totalVehicles === 'number'
          ? fleet.totalVehicles
          : Number(fleet.totalVehicles || 0),
      activeVehicles:
        typeof fleet.activeVehicles === 'number'
          ? fleet.activeVehicles
          : Number(fleet.activeVehicles || 0),
      vehiclesReportingRecently:
        typeof fleet.vehiclesReportingRecently === 'number'
          ? fleet.vehiclesReportingRecently
          : Number(fleet.vehiclesReportingRecently || 0),
      totalDrivers:
        typeof fleet.totalDrivers === 'number'
          ? fleet.totalDrivers
          : Number(fleet.totalDrivers || 0),
      activeDrivers:
        typeof fleet.activeDrivers === 'number'
          ? fleet.activeDrivers
          : Number(fleet.activeDrivers || 0),
    },
    workload: {
      totalStops:
        typeof workload.totalStops === 'number'
          ? workload.totalStops
          : Number(workload.totalStops || 0),
      servicedStops:
        typeof workload.servicedStops === 'number'
          ? workload.servicedStops
          : Number(workload.servicedStops || 0),
      openExceptions:
        typeof workload.openExceptions === 'number'
          ? workload.openExceptions
          : Number(workload.openExceptions || 0),
    },
    routeStatusBreakdown: normalizeBreakdown(record.routeStatusBreakdown),
    exceptionStatusBreakdown: normalizeBreakdown(record.exceptionStatusBreakdown),
  };
};

export const getAnalyticsOverview = async (): Promise<AnalyticsOverviewRecord> => {
  if (isPreview()) {
    return getPreviewAnalyticsOverview();
  }

  const response = await apiFetch('/api/metrics/overview');
  const data = unwrapApiData<unknown>(await response.json());
  return normalizeOverview(data);
};

export const useAnalyticsOverviewQuery = () =>
  useQuery({
    queryKey: queryKeys.analyticsOverview,
    queryFn: getAnalyticsOverview,
  });
