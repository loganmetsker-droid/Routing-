import { EXCEPTION_CATEGORIES, REROUTE_ACTIONS } from './reroute.dto';

describe('reroute dto constants', () => {
  it('contains expected exception categories', () => {
    expect(EXCEPTION_CATEGORIES).toEqual(
      expect.arrayContaining([
        'urgent_insert',
        'vehicle_unavailable',
        'driver_unavailable',
        'missed_time_window',
        'traffic_delay',
        'customer_not_ready',
        'no_show',
        'capacity_issue',
      ]),
    );
  });

  it('contains expected reroute actions', () => {
    expect(REROUTE_ACTIONS).toEqual(
      expect.arrayContaining([
        'reorder_stops',
        'reassign_stop_to_route',
        'split_route',
        'hold_stop',
        'remove_stop',
        'reassign_driver',
      ]),
    );
  });
});
