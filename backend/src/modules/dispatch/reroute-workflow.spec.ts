import { canTransitionRerouteRequest } from './reroute-workflow';

describe('reroute workflow', () => {
  it('allows request -> approve/reject transitions (apply requires approval)', () => {
    expect(canTransitionRerouteRequest('requested', 'approved')).toBe(true);
    expect(canTransitionRerouteRequest('requested', 'rejected')).toBe(true);
    expect(canTransitionRerouteRequest('requested', 'applied')).toBe(false);
    expect(canTransitionRerouteRequest('approved', 'applied')).toBe(true);
  });

  it('blocks invalid transitions', () => {
    expect(canTransitionRerouteRequest('rejected', 'approved')).toBe(false);
    expect(canTransitionRerouteRequest('applied', 'requested')).toBe(false);
    expect(canTransitionRerouteRequest('cancelled', 'approved')).toBe(false);
  });
});
