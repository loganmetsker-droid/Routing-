import { describe, expect, it } from 'vitest';
import type { PlannerRouteGroupWithStops } from './RoutingWorkspaceComponents';
import {
  buildRouteTimelineStops,
  formatTimelineDistance,
  formatTimelineTime,
  summarizeRouteTimeline,
  summarizeRouteTimelines,
} from './routeTimeline';

describe('route timeline presentation', () => {
  const route = {
    id: 'route-al',
    routePlanId: 'plan-1',
    groupIndex: 0,
    label: 'Route route-al',
    driverId: 'driver-1',
    vehicleId: 'vehicle-1',
    totalDistanceKm: 23.8,
    totalDurationMinutes: 126,
    serviceTimeMinutes: 30,
    stops: [
      {
        id: 'stop-2',
        routePlanId: 'plan-1',
        routePlanGroupId: 'route-al',
        jobId: 'job-omega',
        jobStopId: 'job-omega-stop',
        stopSequence: 2,
        isLocked: true,
        plannedArrival: '2026-06-10T16:30:00.000Z',
        metadata: {
          address: '2100 Santa Fe Dr, Denver, CO 80204',
          distanceFromPreviousKm: 4.6,
          serviceMinutes: 20,
        },
        job: {
          id: 'job-omega',
          customerName: 'Omega Medical',
          priority: 'urgent',
          deliveryAddress: '2100 Santa Fe Dr, Denver, CO 80204',
        },
      },
      {
        id: 'stop-1',
        routePlanId: 'plan-1',
        routePlanGroupId: 'route-al',
        jobId: 'job-jane',
        jobStopId: 'job-jane-stop',
        stopSequence: 1,
        isLocked: false,
        plannedArrival: '2026-06-10T15:45:00.000Z',
        metadata: {
          address: '1425 Market Ave, Denver, CO 80202',
          distanceFromPreviousKm: 3.1,
          serviceMinutes: 10,
        },
        job: {
          id: 'job-jane',
          customerName: 'Jane & Sons Bakery',
          priority: 'high',
          deliveryAddress: '1425 Market Ave, Denver, CO 80202',
        },
      },
    ],
  } satisfies PlannerRouteGroupWithStops;

  it('sorts selected route stops and exposes timeline-ready labels', () => {
    const stops = buildRouteTimelineStops(route.stops);

    expect(stops.map((stop) => stop.id)).toEqual(['stop-1', 'stop-2']);
    expect(stops[0]).toMatchObject({
      sequence: 1,
      customerName: 'Jane & Sons Bakery',
      address: '1425 Market Ave, Denver, CO 80202',
      priorityLabel: 'High',
      serviceMinutes: 10,
    });
    expect(stops[1]).toMatchObject({
      sequence: 2,
      customerName: 'Omega Medical',
      distanceMiles: expect.closeTo(2.9, 1),
      isLocked: true,
    });
  });

  it('summarizes the selected route in imperial units', () => {
    const summary = summarizeRouteTimeline(route, buildRouteTimelineStops(route.stops));

    expect(summary.totalStops).toBe(2);
    expect(summary.totalDistanceMiles).toBeCloseTo(14.8, 1);
    expect(summary.driveMinutes).toBe(96);
    expect(summary.serviceMinutes).toBe(30);
    expect(formatTimelineDistance(summary.totalDistanceMiles)).toBe('14.8 mi');
    expect(formatTimelineTime('2026-06-10T15:45:00.000Z')).toMatch(/(10:45 AM|3:45 PM)/);
  });

  it('summarizes all visible routes for all-routes mode', () => {
    const secondRoute = {
      ...route,
      id: 'route-be',
      label: 'Route route-be',
      totalDistanceKm: 7.4,
      totalDurationMinutes: 38,
      serviceTimeMinutes: 8,
      stops: route.stops.slice(0, 1).map((stop) => ({
        ...stop,
        id: 'stop-3',
        routePlanGroupId: 'route-be',
        stopSequence: 1,
      })),
    } satisfies PlannerRouteGroupWithStops;

    const summary = summarizeRouteTimelines([route, secondRoute]);

    expect(summary.totalStops).toBe(3);
    expect(summary.totalDistanceMiles).toBeCloseTo(19.4, 1);
    expect(summary.driveMinutes).toBe(126);
    expect(formatTimelineDistance(summary.totalDistanceMiles)).toBe('19.4 mi');
  });
});
