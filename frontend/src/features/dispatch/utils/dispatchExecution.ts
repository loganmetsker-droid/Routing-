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
