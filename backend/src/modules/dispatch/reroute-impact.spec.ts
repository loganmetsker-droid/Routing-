import {
  buildRerouteImpactSummary,
  isDispatchBlockedByRerouteState,
  preserveDegradedOrSimulatedQuality,
} from './reroute-impact';

describe('reroute impact', () => {
  it('builds before/after impact summary', () => {
    const summary = buildRerouteImpactSummary(
      {
        jobIds: ['a', 'b', 'c'],
        totalDistanceKm: 40,
        totalDurationMinutes: 95,
        dataQuality: 'live',
        optimizationStatus: 'optimized',
      },
      {
        jobIds: ['b', 'a'],
        totalDistanceKm: 34,
        totalDurationMinutes: 88,
        dataQuality: 'degraded',
        optimizationStatus: 'degraded',
      },
    );

    expect(summary.stopOrderChanged).toBe(false);
    expect(summary.droppedJobs).toEqual(['c']);
    expect(summary.insertedJobs).toEqual([]);
    expect(summary.distanceDeltaKm).toBe(-6);
    expect(summary.durationDeltaMinutes).toBe(-7);
    expect(summary.degradedOrSimulated).toBe(true);
  });

  it('keeps simulated quality when reroute is applied', () => {
    expect(preserveDegradedOrSimulatedQuality('simulated')).toBe('simulated');
    expect(preserveDegradedOrSimulatedQuality('live')).toBe('degraded');
  });

  it('enforces reroute gating for dispatch', () => {
    expect(isDispatchBlockedByRerouteState('requested')).toBe(true);
    expect(isDispatchBlockedByRerouteState('approved')).toBe(true);
    expect(isDispatchBlockedByRerouteState('applied')).toBe(false);
    expect(isDispatchBlockedByRerouteState(null)).toBe(false);
  });
});
