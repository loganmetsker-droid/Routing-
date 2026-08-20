import { describe, expect, it } from 'vitest';
import {
  buildRouteDispatchReadiness,
  buildRouteExecutionSummary,
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

  it('prioritizes an active route using final ETA variance when it is available', () => {
    const summary = buildRouteExecutionSummary({
      route: {
        id: 'route-late',
        status: 'in_progress',
        workflowStatus: 'in_progress',
        dispatchedAt: '2026-08-04T13:00:00.000Z',
        plannedStart: '2026-08-04T13:00:00.000Z',
        actualStart: '2026-08-04T13:02:00.000Z',
        completedAt: null,
        eta: '2026-08-04T15:20:00.000Z',
      },
      stops: [
        {
          stopSequence: 1,
          status: 'SERVICED',
          plannedArrival: '2026-08-04T14:00:00.000Z',
          actualArrival: '2026-08-04T14:03:00.000Z',
          actualDeparture: '2026-08-04T14:10:00.000Z',
        },
        {
          stopSequence: 2,
          status: 'PENDING',
          plannedArrival: '2026-08-04T15:00:00.000Z',
          actualArrival: null,
          actualDeparture: null,
        },
      ],
      now: new Date('2026-08-04T14:15:00.000Z'),
    });

    expect(summary).toMatchObject({
      health: 'delayed',
      label: '20m late',
      basis: 'route_eta',
      varianceMinutes: 20,
      processedStops: 1,
      totalStops: 2,
      progressPercent: 50,
      priorityRank: 0,
    });
  });

  it('uses confirmed stop arrival variance when no route ETA exists', () => {
    const summary = buildRouteExecutionSummary({
      route: {
        id: 'route-confirmed',
        status: 'in_progress',
        workflowStatus: 'in_progress',
        dispatchedAt: '2026-08-04T13:00:00.000Z',
        plannedStart: '2026-08-04T13:00:00.000Z',
        actualStart: '2026-08-04T13:00:00.000Z',
        completedAt: null,
        eta: null,
      },
      stops: [
        {
          stopSequence: 1,
          status: 'ARRIVED',
          plannedArrival: '2026-08-04T14:00:00.000Z',
          actualArrival: '2026-08-04T14:08:00.000Z',
          actualDeparture: null,
        },
      ],
      now: new Date('2026-08-04T14:10:00.000Z'),
    });

    expect(summary).toMatchObject({
      health: 'at_risk',
      label: '8m behind',
      basis: 'stop_arrival',
      varianceMinutes: 8,
      processedStops: 0,
      progressPercent: 0,
    });
    expect(summary.basisLabel).toContain('Confirmed stop 1 arrival');
  });

  it('marks a route with no actual start as overdue without inventing telemetry', () => {
    const summary = buildRouteExecutionSummary({
      route: {
        id: 'route-overdue',
        status: 'assigned',
        workflowStatus: 'ready_for_dispatch',
        dispatchedAt: null,
        plannedStart: '2026-08-04T13:00:00.000Z',
        actualStart: null,
        completedAt: null,
        eta: null,
      },
      stops: [],
      now: new Date('2026-08-04T13:17:00.000Z'),
    });

    expect(summary).toMatchObject({
      health: 'delayed',
      label: '17m late',
      basis: 'overdue_start',
      observedAt: '2026-08-04T13:17:00.000Z',
    });
  });

  it('reports unavailable schedule evidence honestly', () => {
    const summary = buildRouteExecutionSummary({
      route: {
        id: 'route-awaiting',
        status: 'in_progress',
        workflowStatus: 'in_progress',
        dispatchedAt: '2026-08-04T13:00:00.000Z',
        plannedStart: null,
        actualStart: '2026-08-04T13:00:00.000Z',
        completedAt: null,
        eta: null,
      },
      stops: [
        {
          stopSequence: 1,
          status: 'PENDING',
          plannedArrival: null,
          actualArrival: null,
          actualDeparture: null,
        },
      ],
      now: new Date('2026-08-04T13:17:00.000Z'),
    });

    expect(summary).toMatchObject({
      health: 'awaiting',
      label: 'Awaiting progress data',
      basis: 'unavailable',
      varianceMinutes: null,
    });
    expect(summary.basisLabel).toMatch(/No comparable/);
  });

  it('keeps completed routes below active attention work while preserving completion variance', () => {
    const summary = buildRouteExecutionSummary({
      route: {
        id: 'route-complete',
        status: 'completed',
        workflowStatus: 'completed',
        dispatchedAt: '2026-08-04T13:00:00.000Z',
        plannedStart: '2026-08-04T13:00:00.000Z',
        actualStart: '2026-08-04T13:00:00.000Z',
        completedAt: '2026-08-04T15:12:00.000Z',
        eta: null,
      },
      stops: [
        {
          stopSequence: 1,
          status: 'SERVICED',
          plannedArrival: '2026-08-04T15:00:00.000Z',
          actualArrival: '2026-08-04T15:05:00.000Z',
          actualDeparture: '2026-08-04T15:12:00.000Z',
        },
      ],
      now: new Date('2026-08-04T15:20:00.000Z'),
    });

    expect(summary).toMatchObject({
      health: 'at_risk',
      label: 'Completed · 12m behind',
      basis: 'completion',
      varianceMinutes: 12,
      progressPercent: 100,
      priorityRank: 80,
    });
  });
});
