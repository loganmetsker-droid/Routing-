import { describe, expect, it } from 'vitest';
import { normalizeTrackingReadiness } from './trackingApi';

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
