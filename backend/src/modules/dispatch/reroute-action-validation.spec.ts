import { validateRerouteActionPayload } from './reroute-action-validation';

describe('reroute action validation', () => {
  const route = {
    jobIds: ['j1', 'j2', 'j3'],
    driverId: 'd1',
    vehicleId: 'v1',
  };

  it('validates reorder_stops payload', () => {
    expect(() =>
      validateRerouteActionPayload('reorder_stops', { newJobOrder: ['j2', 'j1', 'j3'] }, route as any),
    ).not.toThrow();
  });

  it('rejects invalid reorder_stops payload', () => {
    expect(() =>
      validateRerouteActionPayload('reorder_stops', { newJobOrder: ['j2'] }, route as any),
    ).toThrow();
  });

  it('validates split_route payload', () => {
    expect(() =>
      validateRerouteActionPayload('split_route', { splitAtIndex: 1 }, route as any),
    ).not.toThrow();
  });

  it('rejects invalid split_route payload', () => {
    expect(() =>
      validateRerouteActionPayload('split_route', { splitAtIndex: 0 }, route as any),
    ).toThrow();
  });

  it('requires targetRouteId for reassign_stop_to_route', () => {
    expect(() =>
      validateRerouteActionPayload('reassign_stop_to_route', { jobId: 'j1' }, route as any),
    ).toThrow();
    expect(() =>
      validateRerouteActionPayload(
        'reassign_stop_to_route',
        { jobId: 'j1', targetRouteId: 'r2' },
        route as any,
      ),
    ).not.toThrow();
  });
});
