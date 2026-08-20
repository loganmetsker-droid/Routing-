import { describe, expect, it } from 'vitest';
import type { RouteRecord, TrackingVehicleLocation } from '../../services/api.types';
import {
  calculateTelemetryDistanceKm,
  formatTelemetryAge,
  getPlannedRoutePositions,
  getTelemetryFreshness,
  prepareTelemetryHistory,
} from './telemetryHistory';

const point = (
  timestamp: string,
  latitude: number,
  longitude: number,
  vehicleId = 'vehicle-1',
): TrackingVehicleLocation => ({
  vehicleId,
  latitude,
  longitude,
  timestamp,
});

describe('telemetry history utilities', () => {
  it('classifies live, delayed, stale, and unavailable signal ages', () => {
    const now = new Date('2026-08-04T12:00:00.000Z').getTime();

    expect(getTelemetryFreshness('2026-08-04T11:59:00.000Z', now)).toBe('live');
    expect(getTelemetryFreshness('2026-08-04T11:55:00.000Z', now)).toBe('delayed');
    expect(getTelemetryFreshness('2026-08-04T11:40:00.000Z', now)).toBe('stale');
    expect(getTelemetryFreshness('not-a-date', now)).toBe('unavailable');
    expect(formatTelemetryAge('2026-08-04T11:55:00.000Z', now)).toBe('5m ago');
  });

  it('filters invalid and foreign points, deduplicates them, and sorts chronologically', () => {
    const input = [
      point('2026-08-04T12:05:00.000Z', 39.75, -104.99),
      point('2026-08-04T12:00:00.000Z', 39.74, -105),
      point('2026-08-04T12:00:00.000Z', 39.74, -105),
      point('2026-08-04T12:03:00.000Z', 95, -105),
      point('2026-08-04T12:04:00.000Z', 39.7, -104.9, 'vehicle-2'),
    ];

    expect(prepareTelemetryHistory(input, 'vehicle-1')).toEqual([
      input[1],
      input[0],
    ]);
  });

  it('calculates distance only from recorded points', () => {
    const distance = calculateTelemetryDistanceKm([
      point('2026-08-04T12:00:00.000Z', 0, 0),
      point('2026-08-04T12:05:00.000Z', 0, 1),
    ]);

    expect(distance).toBeGreaterThan(111);
    expect(distance).toBeLessThan(112);
  });

  it('extracts longitude-latitude route geometry into Leaflet positions', () => {
    const route = {
      id: 'route-1',
      vehicleId: 'vehicle-1',
      status: 'in_progress',
      jobIds: [],
      routeData: {
        polyline: {
          coordinates: [
            [-105, 39.7],
            [-104.9, 39.8],
          ],
        },
      },
    } as RouteRecord;

    expect(getPlannedRoutePositions(route)).toEqual([
      [39.7, -105],
      [39.8, -104.9],
    ]);
  });
});
