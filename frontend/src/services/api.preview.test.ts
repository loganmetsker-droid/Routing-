import { describe, expect, it } from 'vitest';
import {
  buildPreviewTrackingSnapshot,
  getPreviewVersionsForRoute,
  previewState,
} from './api.preview';

describe('api preview adapter', () => {
  it('builds a tracking snapshot from preview routes', () => {
    const snapshot = buildPreviewTrackingSnapshot();

    expect(snapshot.count).toBeGreaterThan(0);
    expect(snapshot.vehicles[0]).toEqual(
      expect.objectContaining({
        vehicleId: expect.any(String),
        latitude: expect.any(Number),
        longitude: expect.any(Number),
      }),
    );
  });

  it('sorts route versions newest-first without mutating seed order', () => {
    const routeId = 'route-alpha-001';
    const versions = getPreviewVersionsForRoute(routeId);

    expect(versions.map((version) => version.versionNumber)).toEqual([2, 1]);
    expect(previewState.routeVersions[routeId][0].versionNumber).toBe(1);
  });
});
