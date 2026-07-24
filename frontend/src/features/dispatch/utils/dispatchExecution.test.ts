import { describe, expect, it } from 'vitest';
import {
  buildRouteDispatchReadiness,
  getRouteDispatchState,
  resolveDriverVehicleAssignment,
} from './dispatchExecution';

describe('dispatch execution helpers', () => {
  it('labels assigned routes with sent metadata as sent to driver', () => {
    expect(
      getRouteDispatchState({
        id: 'route-1',
        status: 'assigned',
        workflowStatus: 'ready_for_dispatch',
        dispatchedAt: '2026-06-08T18:30:00.000Z',
      }),
    ).toEqual({
      key: 'sent_to_driver',
      label: 'Sent to driver',
      tone: 'success',
    });
  });

  it('builds critical readiness blockers for routes that cannot be dispatched', () => {
    const readiness = buildRouteDispatchReadiness({
      route: {
        id: 'route-1',
        status: 'planned',
        driverId: null,
        vehicleId: null,
      },
      stops: [],
      exceptions: [
        {
          id: 'exception-1',
          routeId: 'route-1',
          code: 'ACCESS_ISSUE',
          message: 'Dock is blocked',
          status: 'OPEN',
        },
      ],
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.map((blocker) => blocker.code)).toEqual([
      'MISSING_DRIVER',
      'MISSING_VEHICLE',
      'NO_STOPS',
      'OPEN_EXCEPTION',
    ]);
  });

  it('uses the selected driver current vehicle when a vehicle is not explicitly chosen', () => {
    expect(
      resolveDriverVehicleAssignment({
        selectedDriverId: 'driver-1',
        selectedVehicleId: '',
        routeVehicleId: null,
        drivers: [
          {
            id: 'driver-1',
            currentVehicleId: 'vehicle-1',
          },
        ],
      }),
    ).toEqual({
      driverId: 'driver-1',
      vehicleId: 'vehicle-1',
    });
  });
});
