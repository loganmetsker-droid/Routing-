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

  it('provides enough preview demand and vehicles for ten-stop lanes in the routing capture', () => {
    const unassignedJobs = previewState.jobs.filter((job) => !job.assignedRouteId);

    expect(previewState.vehicles.length).toBeGreaterThanOrEqual(5);
    expect(unassignedJobs.length).toBeGreaterThanOrEqual(50);
    expect(previewState.jobs.map((job) => job.customerName)).not.toContain('Route Ops QA');
  });

  it('spreads preview demand across visibly separate Denver routing corridors', () => {
    const coordinates = previewState.jobs
      .filter((job) => !job.assignedRouteId)
      .map((job) => job.deliveryLocation)
      .filter(
        (location): location is { lat: number; lng: number } =>
          Boolean(location) &&
          typeof location?.lat === 'number' &&
          typeof location?.lng === 'number',
      );
    const latitudes = coordinates.map((location) => location.lat);
    const longitudes = coordinates.map((location) => location.lng);
    const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
    const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);

    expect(latitudeSpan).toBeGreaterThan(0.14);
    expect(longitudeSpan).toBeGreaterThan(0.16);
  });
});
