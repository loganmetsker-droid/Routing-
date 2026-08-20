import { describe, expect, it } from 'vitest';
import {
  normalizeTrackingHistoryResponse,
  normalizeTrackingReadiness,
} from './trackingApi';

describe('normalizeTrackingReadiness', () => {
  it('unwraps the backend API envelope and defaults sparse readiness counts', () => {
    const readiness = normalizeTrackingReadiness({
      data: {
        ready: true,
        checkedAt: '2026-06-13T04:30:05.005Z',
        organizationId: 'org-1',
        summary: {
          telemetryRecords: 0,
          vehiclesTracked: 0,
          activeVehicles: 0,
        },
      },
      meta: { request_id: 'req-1', timestamp: '2026-06-13T04:30:05.005Z' },
      error: null,
    });

    expect(readiness).toEqual({
      ready: true,
      checkedAt: '2026-06-13T04:30:05.005Z',
      organizationId: 'org-1',
      summary: {
        telemetryRecords: 0,
        vehiclesTracked: 0,
        activeVehicles: 0,
        latestTelemetryAt: undefined,
      },
    });
  });
});

describe('normalizeTrackingHistoryResponse', () => {
  it('unwraps, sorts, and describes a bounded telemetry history response', () => {
    const history = normalizeTrackingHistoryResponse(
      {
        data: {
          vehicleId: 'vehicle-1',
          organizationId: 'org-1',
          rangeHours: 6,
          pointLimit: 1000,
          pointLimitReached: false,
          source: 'telemetry',
          history: [
            {
              vehicleId: 'vehicle-1',
              location: { lat: 39.8, lng: -104.9 },
              timestamp: '2026-08-04T12:05:00.000Z',
            },
            {
              vehicleId: 'vehicle-1',
              latitude: 39.7,
              longitude: -105,
              timestamp: '2026-08-04T12:00:00.000Z',
            },
          ],
        },
      },
      'vehicle-fallback',
      24,
    );

    expect(history).toMatchObject({
      vehicleId: 'vehicle-1',
      organizationId: 'org-1',
      rangeHours: 6,
      count: 2,
      order: 'ascending',
      source: 'telemetry',
      oldestAt: '2026-08-04T12:00:00.000Z',
      newestAt: '2026-08-04T12:05:00.000Z',
    });
    expect(history.history.map((point) => point.timestamp)).toEqual([
      '2026-08-04T12:00:00.000Z',
      '2026-08-04T12:05:00.000Z',
    ]);
  });

  it('drops malformed coordinates and timestamps rather than presenting fresh telemetry', () => {
    const history = normalizeTrackingHistoryResponse(
      {
        history: [
          {
            vehicleId: 'vehicle-1',
            latitude: 91,
            longitude: -105,
            timestamp: '2026-08-04T12:00:00.000Z',
          },
          {
            vehicleId: 'vehicle-1',
            latitude: 39.7,
            longitude: -105,
          },
        ],
      },
      'vehicle-1',
      6,
    );

    expect(history.history).toEqual([]);
    expect(history.count).toBe(0);
  });
});
