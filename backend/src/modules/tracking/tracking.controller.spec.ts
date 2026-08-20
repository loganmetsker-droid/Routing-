import { describe, expect, it, vi } from 'vitest';
import { TrackingController } from './tracking.controller';

describe('TrackingController history contract', () => {
  it('returns a bounded, chronological, organization-scoped replay contract', async () => {
    const points = [
      {
        vehicleId: 'vehicle-1',
        latitude: 39.7,
        longitude: -105,
        timestamp: '2026-08-04T12:00:00.000Z',
      },
      {
        vehicleId: 'vehicle-1',
        latitude: 39.8,
        longitude: -104.9,
        timestamp: '2026-08-04T12:05:00.000Z',
      },
    ];
    const trackingService = {
      getVehicleLocationHistory: vi.fn(async () => points),
    };
    const controller = new TrackingController(trackingService as never);

    const response = await controller.history(
      { user: { organizationId: 'org-1' } },
      'vehicle-1',
      999,
    );

    expect(trackingService.getVehicleLocationHistory).toHaveBeenCalledWith(
      'vehicle-1',
      168,
      'org-1',
    );
    expect(response).toMatchObject({
      vehicleId: 'vehicle-1',
      organizationId: 'org-1',
      rangeHours: 168,
      count: 2,
      pointLimit: 1000,
      pointLimitReached: false,
      order: 'ascending',
      source: 'telemetry',
      oldestAt: '2026-08-04T12:00:00.000Z',
      newestAt: '2026-08-04T12:05:00.000Z',
    });
  });
});
