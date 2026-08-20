import {
  calculateRouteDriverFamiliarity,
  DRIVER_FAMILIARITY_MIN_ROUTES,
  DRIVER_FAMILIARITY_MIN_STOPS,
} from './driver-familiarity';

const completedAt = new Date('2026-06-01T18:00:00.000Z');
const targetLocations = [
  { lat: 41.881, lng: -87.631 },
  { lat: 41.891, lng: -87.641 },
  { lat: 41.901, lng: -87.651 },
];

describe('driver familiarity', () => {
  it('recommends an evidence-eligible driver with strong route coverage', () => {
    const visits = Array.from({ length: DRIVER_FAMILIARITY_MIN_STOPS }, (_, index) => ({
      driverId: 'driver-familiar',
      routeId: `route-${index % DRIVER_FAMILIARITY_MIN_ROUTES}`,
      location: targetLocations[index % targetLocations.length],
      completedAt,
    }));
    const result = calculateRouteDriverFamiliarity({
      groupId: 'group-1',
      targetLocations,
      driverIds: ['driver-new', 'driver-familiar'],
      visits,
    });

    expect(result.status).toBe('supported');
    expect(result.recommendedDriverId).toBe('driver-familiar');
    expect(result.candidates[0]).toMatchObject({ eligible: true, bars: 3, coveragePercent: 100 });
  });

  it('does not recommend a driver from a single completed route', () => {
    const visits = Array.from({ length: DRIVER_FAMILIARITY_MIN_STOPS }, (_, index) => ({
      driverId: 'driver-1',
      routeId: 'one-route',
      location: targetLocations[index % targetLocations.length],
      completedAt,
    }));
    const result = calculateRouteDriverFamiliarity({
      groupId: 'group-1',
      targetLocations,
      driverIds: ['driver-1'],
      visits,
    });

    expect(result.status).toBe('insufficient_driver_history');
    expect(result.recommendedDriverId).toBeNull();
    expect(result.candidates[0]).toMatchObject({ eligible: false, bars: 3 });
  });

  it('requires current route coordinates before scoring familiarity', () => {
    const result = calculateRouteDriverFamiliarity({
      groupId: 'group-1',
      targetLocations: [],
      driverIds: ['driver-1'],
      visits: [],
    });
    expect(result.status).toBe('insufficient_route_locations');
    expect(result.recommendedDriverId).toBeNull();
  });

  it('does not treat a visit outside the two-kilometer radius as familiar', () => {
    const visits = Array.from({ length: DRIVER_FAMILIARITY_MIN_STOPS }, (_, index) => ({
      driverId: 'driver-1',
      routeId: `route-${index % DRIVER_FAMILIARITY_MIN_ROUTES}`,
      location: { lat: 42.1, lng: -87.9 },
      completedAt,
    }));
    const result = calculateRouteDriverFamiliarity({
      groupId: 'group-1',
      targetLocations,
      driverIds: ['driver-1'],
      visits,
    });
    expect(result.candidates[0]).toMatchObject({ eligible: true, bars: 0, coveragePercent: 0 });
    expect(result.recommendedDriverId).toBeNull();
  });
});
