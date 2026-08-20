import type { PlannerRouteGroupWithStops, PlannerStopWithJob } from './RoutingWorkspaceComponents';
import { getPriorityLabel, stopLabel } from './RoutingWorkspaceComponents';

export type RouteTimelineStop = {
  id: string;
  sequence: number;
  jobId: string;
  customerName: string;
  address: string;
  plannedArrival?: string | null;
  plannedDeparture?: string | null;
  priorityLabel: string;
  serviceMinutes: number | null;
  distanceMiles: number | null;
  isLocked: boolean;
};

export type RouteTimelineSummary = {
  totalStops: number;
  totalDistanceMiles: number;
  totalDurationMinutes: number;
  driveMinutes: number;
  serviceMinutes: number;
  fuelCost: number;
  laborCost: number;
};

const KM_TO_MILES = 0.621371;
const FUEL_COST_PER_MILE = 0.62;
const LABOR_COST_PER_HOUR = 32;

function readNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readMetadataNumber(stop: PlannerStopWithJob, keys: string[]) {
  for (const key of keys) {
    const value = readNumber(stop.metadata?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function getStopAddress(stop: PlannerStopWithJob) {
  return stopLabel(stop) || stop.job?.deliveryAddress || stop.job?.pickupAddress || 'Address pending';
}

export function buildRouteTimelineStops(stops: PlannerStopWithJob[]): RouteTimelineStop[] {
  return [...stops]
    .sort((left, right) => left.stopSequence - right.stopSequence)
    .map((stop, index) => {
      const distanceKm = readMetadataNumber(stop, [
        'distanceFromPreviousKm',
        'legDistanceKm',
        'distanceKm',
        'estimatedDistanceKm',
      ]);
      return {
        id: stop.id,
        sequence: stop.stopSequence || index + 1,
        jobId: stop.jobId,
        customerName: stop.job?.customerName || stop.jobId,
        address: getStopAddress(stop),
        plannedArrival: stop.plannedArrival,
        plannedDeparture: stop.plannedDeparture,
        priorityLabel: getPriorityLabel(stop.job?.priority),
        serviceMinutes: readMetadataNumber(stop, ['serviceMinutes', 'durationMinutes', 'plannedServiceMinutes']),
        distanceMiles: distanceKm === null ? null : distanceKm * KM_TO_MILES,
        isLocked: Boolean(stop.isLocked),
      };
    });
}

export function summarizeRouteTimeline(
  group: PlannerRouteGroupWithStops | null,
  stops: RouteTimelineStop[],
): RouteTimelineSummary {
  const totalDistanceMiles = Math.max(0, Number(group?.totalDistanceKm || 0) * KM_TO_MILES);
  const totalDurationMinutes = Math.max(0, Math.round(Number(group?.totalDurationMinutes || 0)));
  const routeServiceMinutes = Math.max(0, Math.round(Number(group?.serviceTimeMinutes || 0)));
  const stopServiceMinutes = stops.reduce((total, stop) => total + Math.max(0, Math.round(stop.serviceMinutes || 0)), 0);
  const serviceMinutes = routeServiceMinutes || stopServiceMinutes;
  const driveMinutes = Math.max(0, totalDurationMinutes - serviceMinutes);

  return {
    totalStops: stops.length,
    totalDistanceMiles,
    totalDurationMinutes,
    driveMinutes,
    serviceMinutes,
    fuelCost: totalDistanceMiles * FUEL_COST_PER_MILE,
    laborCost: (totalDurationMinutes / 60) * LABOR_COST_PER_HOUR,
  };
}

export function summarizeRouteTimelines(groups: PlannerRouteGroupWithStops[]): RouteTimelineSummary {
  return groups.reduce<RouteTimelineSummary>(
    (total, group) => {
      const routeSummary = summarizeRouteTimeline(group, buildRouteTimelineStops(group.stops));
      return {
        totalStops: total.totalStops + routeSummary.totalStops,
        totalDistanceMiles: total.totalDistanceMiles + routeSummary.totalDistanceMiles,
        totalDurationMinutes: total.totalDurationMinutes + routeSummary.totalDurationMinutes,
        driveMinutes: total.driveMinutes + routeSummary.driveMinutes,
        serviceMinutes: total.serviceMinutes + routeSummary.serviceMinutes,
        fuelCost: total.fuelCost + routeSummary.fuelCost,
        laborCost: total.laborCost + routeSummary.laborCost,
      };
    },
    {
      totalStops: 0,
      totalDistanceMiles: 0,
      totalDurationMinutes: 0,
      driveMinutes: 0,
      serviceMinutes: 0,
      fuelCost: 0,
      laborCost: 0,
    },
  );
}

export function formatTimelineDistance(miles?: number | null) {
  const value = Number(miles);
  if (!Number.isFinite(value)) return '--';
  return `${Math.max(0, value).toFixed(1)} mi`;
}

export function formatTimelineDuration(minutes?: number | null) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (!hours) return `${remainingMinutes}m`;
  if (!remainingMinutes) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

export function formatTimelineMoney(value?: number | null) {
  const safeValue = Math.max(0, Number(value || 0));
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(safeValue);
}

export function formatTimelineTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
