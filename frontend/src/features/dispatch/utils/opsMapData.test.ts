import { describe, expect, it } from 'vitest';
import { buildDispatchMapRoutes } from './opsMapData';

const baseRoute = {
  id: 'route-1',
  vehicleId: 'vehicle-1',
  driverId: null,
  status: 'in_progress',
  workflowStatus: 'in_progress',
  jobIds: ['job-1'],
};

const baseJob = {
  id: 'job-1',
  customerName: 'Customer',
  deliveryAddress: '100 Main St',
  deliveryLocation: { lat: 39.75, lng: -104.99 },
  status: 'assigned',
};

describe('dispatch operations map data', () => {
  it('uses the real vehicle location for the live vehicle marker', () => {
    const [route] = buildDispatchMapRoutes({
      routes: [baseRoute],
      jobs: [baseJob],
      drivers: [],
      vehicles: [
        {
          id: 'vehicle-1',
          make: 'Ford',
          model: 'Transit',
          licensePlate: 'DEN-112',
          status: 'in_use',
          currentLocation: { lat: 39.71, lng: -105.01 },
        },
      ],
    });

    expect(route.vehicle?.currentLocation).toEqual({ lat: 39.71, lng: -105.01 });
    expect(route.vehicle?.currentLocation).not.toEqual(baseJob.deliveryLocation);
  });

  it('does not invent a live vehicle location from the first planned stop', () => {
    const [route] = buildDispatchMapRoutes({
      routes: [baseRoute],
      jobs: [baseJob],
      drivers: [],
      vehicles: [
        {
          id: 'vehicle-1',
          make: 'Ford',
          model: 'Transit',
          licensePlate: 'DEN-112',
          status: 'in_use',
        },
      ],
    });

    expect(route.stops?.[0]).toMatchObject(baseJob.deliveryLocation);
    expect(route.vehicle?.currentLocation).toBeUndefined();
  });
});
