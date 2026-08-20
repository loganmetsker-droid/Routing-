import type {
  DispatchExceptionRecord,
  RouteRunRecord,
  RouteRunStopRecord,
} from '../api/routeRunsApi';
import type { DriverRecord } from '../../../services/api.types';

export type DispatchExecutionState = {
  key: 'planned' | 'ready' | 'sent_to_driver' | 'in_progress' | 'completed' | 'cancelled';
  label: string;
  tone: 'default' | 'accent' | 'info' | 'success' | 'warning' | 'danger';
};

export type DispatchReadinessBlocker = {
  code: 'MISSING_DRIVER' | 'MISSING_VEHICLE' | 'NO_STOPS' | 'OPEN_EXCEPTION' | 'ROUTE_NOT_EDITABLE';
  message: string;
  severity: 'blocking';
  routeId: string;
  exceptionId?: string | null;
};

export type DispatchReadiness = {
  ready: boolean;
  blockers: DispatchReadinessBlocker[];
};

export type RouteExecutionHealth =
  | 'delayed'
  | 'at_risk'
  | 'on_time'
  | 'ahead'
  | 'awaiting'
  | 'cancelled';

export type RouteExecutionBasis =
  | 'completion'
  | 'route_eta'
  | 'stop_arrival'
  | 'stop_departure'
  | 'start'
  | 'overdue_start'
  | 'unavailable';

export type RouteExecutionSummary = {
  health: RouteExecutionHealth;
  label: string;
  tone: 'default' | 'info' | 'success' | 'warning' | 'danger';
  basis: RouteExecutionBasis;
  basisLabel: string;
  varianceMinutes: number | null;
  plannedAt: string | null;
  observedAt: string | null;
  processedStops: number;
  totalStops: number;
  progressPercent: number;
  priorityRank: number;
  phase: DispatchExecutionState['key'];
};

const PROCESSED_STOP_STATUSES = new Set([
  'completed',
  'departed',
  'serviced',
  'failed',
  'rescheduled',
  'skipped',
]);

const toTimestamp = (value?: string | null) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const minutesBetween = (plannedAt: string, observedAt: string) => {
  const planned = toTimestamp(plannedAt);
  const observed = toTimestamp(observedAt);
  if (planned == null || observed == null) return null;
  return Math.round((observed - planned) / 60_000);
};

const varianceHealth = (varianceMinutes: number): RouteExecutionHealth => {
  if (varianceMinutes >= 15) return 'delayed';
  if (varianceMinutes >= 5) return 'at_risk';
  if (varianceMinutes <= -5) return 'ahead';
  return 'on_time';
};

const healthPresentation = (
  health: RouteExecutionHealth,
  varianceMinutes: number | null,
  phase: DispatchExecutionState['key'],
) => {
  const magnitude = varianceMinutes == null ? null : Math.abs(varianceMinutes);
  const completedPrefix = phase === 'completed' ? 'Completed · ' : '';
  if (health === 'delayed') {
    return {
      label: `${completedPrefix}${magnitude}m late`,
      tone: 'danger' as const,
    };
  }
  if (health === 'at_risk') {
    return {
      label: `${completedPrefix}${magnitude}m behind`,
      tone: 'warning' as const,
    };
  }
  if (health === 'ahead') {
    return {
      label: `${completedPrefix}${magnitude}m ahead`,
      tone: 'success' as const,
    };
  }
  if (health === 'on_time') {
    return {
      label: phase === 'completed' ? 'Completed · on plan' : 'On plan',
      tone: 'success' as const,
    };
  }
  if (health === 'cancelled') {
    return { label: 'Cancelled', tone: 'default' as const };
  }
  return {
    label:
      phase === 'in_progress'
        ? 'Awaiting progress data'
        : phase === 'planned' || phase === 'ready' || phase === 'sent_to_driver'
          ? 'Awaiting route start'
          : 'Schedule data unavailable',
    tone: 'default' as const,
  };
};

const executionPriority = (
  phase: DispatchExecutionState['key'],
  health: RouteExecutionHealth,
) => {
  if (phase === 'cancelled') return 90;
  if (phase === 'completed') return 80;
  if (health === 'delayed') return 0;
  if (health === 'at_risk') return 10;
  if (phase === 'in_progress' && health === 'awaiting') return 20;
  if (phase === 'in_progress') return 30;
  if (health === 'awaiting') return 50;
  return 40;
};

export function buildRouteExecutionSummary({
  route,
  stops,
  now = new Date(),
}: {
  route: Pick<
    RouteRunRecord,
    | 'id'
    | 'status'
    | 'workflowStatus'
    | 'dispatchedAt'
    | 'plannedStart'
    | 'actualStart'
    | 'completedAt'
    | 'eta'
  >;
  stops: Array<
    Pick<
      RouteRunStopRecord,
      'status' | 'stopSequence' | 'plannedArrival' | 'actualArrival' | 'actualDeparture'
    >
  >;
  now?: Date;
}): RouteExecutionSummary {
  const phase = getRouteDispatchState(route).key;
  const orderedStops = stops
    .slice()
    .sort((left, right) => left.stopSequence - right.stopSequence);
  const processedStops = orderedStops.filter((stop) =>
    PROCESSED_STOP_STATUSES.has(String(stop.status || '').toLowerCase()),
  ).length;
  const totalStops = orderedStops.length;
  const progressPercent = totalStops
    ? Math.round((processedStops / totalStops) * 100)
    : 0;
  const finalPlannedStop = orderedStops
    .slice()
    .reverse()
    .find((stop) => toTimestamp(stop.plannedArrival) != null);
  const latestConfirmedStop = orderedStops
    .filter(
      (stop) =>
        toTimestamp(stop.plannedArrival) != null &&
        (toTimestamp(stop.actualArrival) != null ||
          toTimestamp(stop.actualDeparture) != null),
    )
    .sort((left, right) => {
      const leftTime =
        toTimestamp(left.actualArrival) ?? toTimestamp(left.actualDeparture) ?? 0;
      const rightTime =
        toTimestamp(right.actualArrival) ?? toTimestamp(right.actualDeparture) ?? 0;
      return rightTime - leftTime;
    })[0];

  let basis: RouteExecutionBasis = 'unavailable';
  let basisLabel = 'No comparable planned and actual timestamps are available.';
  let plannedAt: string | null = null;
  let observedAt: string | null = null;

  if (phase === 'cancelled') {
    const presentation = healthPresentation('cancelled', null, phase);
    return {
      health: 'cancelled',
      ...presentation,
      basis,
      basisLabel: 'Cancelled routes are excluded from schedule priority.',
      varianceMinutes: null,
      plannedAt,
      observedAt,
      processedStops,
      totalStops,
      progressPercent,
      priorityRank: executionPriority(phase, 'cancelled'),
      phase,
    };
  }

  if (phase === 'completed' && route.completedAt && finalPlannedStop?.plannedArrival) {
    basis = 'completion';
    basisLabel = 'Completion time compared with the planned final-stop arrival.';
    plannedAt = finalPlannedStop.plannedArrival;
    observedAt = route.completedAt;
  } else if (
    phase === 'in_progress' &&
    route.eta &&
    finalPlannedStop?.plannedArrival
  ) {
    basis = 'route_eta';
    basisLabel = 'Current route ETA compared with the planned final-stop arrival.';
    plannedAt = finalPlannedStop.plannedArrival;
    observedAt = route.eta;
  } else if (latestConfirmedStop?.plannedArrival && latestConfirmedStop.actualArrival) {
    basis = 'stop_arrival';
    basisLabel = `Confirmed stop ${latestConfirmedStop.stopSequence} arrival compared with plan.`;
    plannedAt = latestConfirmedStop.plannedArrival;
    observedAt = latestConfirmedStop.actualArrival;
  } else if (latestConfirmedStop?.plannedArrival && latestConfirmedStop.actualDeparture) {
    basis = 'stop_departure';
    basisLabel = `Confirmed stop ${latestConfirmedStop.stopSequence} departure compared with its planned arrival; service time is included.`;
    plannedAt = latestConfirmedStop.plannedArrival;
    observedAt = latestConfirmedStop.actualDeparture;
  } else if (route.plannedStart && route.actualStart) {
    basis = 'start';
    basisLabel = 'Actual route start compared with planned start.';
    plannedAt = route.plannedStart;
    observedAt = route.actualStart;
  } else if (
    route.plannedStart &&
    !route.actualStart &&
    !['completed', 'cancelled'].includes(phase) &&
    (toTimestamp(route.plannedStart) ?? Number.POSITIVE_INFINITY) < now.getTime()
  ) {
    basis = 'overdue_start';
    basisLabel = 'Route has not started and its planned start is overdue.';
    plannedAt = route.plannedStart;
    observedAt = now.toISOString();
  } else if (
    route.plannedStart &&
    !route.actualStart &&
    ['planned', 'ready', 'sent_to_driver'].includes(phase)
  ) {
    plannedAt = route.plannedStart;
    basisLabel = 'Route has not started; variance begins at its planned start.';
  }

  const varianceMinutes =
    plannedAt && observedAt ? minutesBetween(plannedAt, observedAt) : null;
  const health =
    varianceMinutes == null ? 'awaiting' : varianceHealth(varianceMinutes);
  const presentation = healthPresentation(health, varianceMinutes, phase);

  return {
    health,
    ...presentation,
    basis,
    basisLabel,
    varianceMinutes,
    plannedAt,
    observedAt,
    processedStops,
    totalStops,
    progressPercent,
    priorityRank: executionPriority(phase, health),
    phase,
  };
}

export function getRouteDispatchState(route: Pick<RouteRunRecord, 'id' | 'status' | 'workflowStatus' | 'dispatchedAt'>): DispatchExecutionState {
  const status = String(route.status || '').toLowerCase();
  const workflowStatus = String(route.workflowStatus || '').toLowerCase();

  if (status === 'completed' || workflowStatus === 'completed') {
    return { key: 'completed', label: 'Completed', tone: 'success' };
  }
  if (status === 'cancelled' || workflowStatus === 'cancelled') {
    return { key: 'cancelled', label: 'Cancelled', tone: 'danger' };
  }
  if (status === 'in_progress' || workflowStatus === 'in_progress') {
    return { key: 'in_progress', label: 'In progress', tone: 'info' };
  }
  if (route.dispatchedAt) {
    return { key: 'sent_to_driver', label: 'Sent to driver', tone: 'success' };
  }
  if (status === 'assigned' || workflowStatus === 'ready_for_dispatch') {
    return { key: 'ready', label: 'Ready', tone: 'accent' };
  }
  return { key: 'planned', label: 'Planned', tone: 'default' };
}

export function buildRouteDispatchReadiness({
  route,
  stops,
  exceptions,
}: {
  route: Pick<RouteRunRecord, 'id' | 'status' | 'driverId' | 'vehicleId'>;
  stops: Array<Pick<RouteRunStopRecord, 'routeId'>>;
  exceptions: Array<Pick<DispatchExceptionRecord, 'id' | 'routeId' | 'code' | 'message' | 'status'>>;
}): DispatchReadiness {
  const routeId = route.id;
  const blockers: DispatchReadinessBlocker[] = [];
  const status = String(route.status || '').toLowerCase();

  if (['in_progress', 'completed', 'cancelled'].includes(status)) {
    blockers.push({
      code: 'ROUTE_NOT_EDITABLE',
      message: 'Only planned or ready routes can be sent to a driver.',
      severity: 'blocking',
      routeId,
    });
  }
  if (!route.driverId) {
    blockers.push({
      code: 'MISSING_DRIVER',
      message: 'Assign a driver before dispatch.',
      severity: 'blocking',
      routeId,
    });
  }
  if (!route.vehicleId) {
    blockers.push({
      code: 'MISSING_VEHICLE',
      message: 'Assign a vehicle before dispatch.',
      severity: 'blocking',
      routeId,
    });
  }
  if (stops.length === 0) {
    blockers.push({
      code: 'NO_STOPS',
      message: 'Add at least one stop before dispatch.',
      severity: 'blocking',
      routeId,
    });
  }
  exceptions
    .filter((exception) => String(exception.status || '').toUpperCase() === 'OPEN')
    .forEach((exception) => {
      blockers.push({
        code: 'OPEN_EXCEPTION',
        message: `${exception.code}: ${exception.message}`,
        severity: 'blocking',
        routeId,
        exceptionId: exception.id,
      });
    });

  return {
    ready: blockers.length === 0,
    blockers,
  };
}

export function resolveDriverVehicleAssignment({
  selectedDriverId,
  selectedVehicleId,
  routeVehicleId,
  drivers,
}: {
  selectedDriverId?: string | null;
  selectedVehicleId?: string | null;
  routeVehicleId?: string | null;
  drivers: Array<Pick<DriverRecord, 'id' | 'currentVehicleId' | 'assignedVehicleId'>>;
}) {
  const driver = drivers.find((item) => item.id === selectedDriverId);
  return {
    driverId: selectedDriverId || undefined,
    vehicleId:
      selectedVehicleId ||
      driver?.currentVehicleId ||
      driver?.assignedVehicleId ||
      routeVehicleId ||
      undefined,
  };
}
