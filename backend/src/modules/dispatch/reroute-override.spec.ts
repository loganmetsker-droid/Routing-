import { validateRerouteOverride } from './reroute-override';

describe('reroute override validation', () => {
  it('allows non-override flow', () => {
    expect(() =>
      validateRerouteOverride({ overrideRequested: false }),
    ).not.toThrow();
  });

  it('requires reason for override', () => {
    expect(() =>
      validateRerouteOverride({ overrideRequested: true, overrideReason: '' }),
    ).toThrow();
  });

  it('requires meaningful override reason length', () => {
    expect(() =>
      validateRerouteOverride({ overrideRequested: true, overrideReason: 'short' }),
    ).toThrow();
  });

  it('accepts valid override reason', () => {
    expect(() =>
      validateRerouteOverride({
        overrideRequested: true,
        overrideReason: 'Pump failure at active pour site',
        overrideActorRole: 'admin',
      }),
    ).not.toThrow();
  });

  it('denies viewer override role', () => {
    expect(() =>
      validateRerouteOverride({
        overrideRequested: true,
        overrideReason: 'Operational emergency reroute',
        overrideActorRole: 'viewer',
      }),
    ).toThrow();
  });

  it('denies hard-blocked reason codes', () => {
    expect(() =>
      validateRerouteOverride({
        overrideRequested: true,
        overrideReason: 'Attempting to bypass missing route',
        overrideActorRole: 'admin',
        blockedReasonCodes: ['TARGET_ROUTE_NOT_FOUND'],
      }),
    ).toThrow();
  });

  it('allows dispatcher only for allowed matrix reason codes', () => {
    expect(() =>
      validateRerouteOverride({
        overrideRequested: true,
        overrideReason: 'Traffic requires constrained delay acceptance',
        overrideActorRole: 'dispatcher',
        blockedReasonCodes: ['TIME_WINDOW_VIOLATION'],
      }),
    ).not.toThrow();
    expect(() =>
      validateRerouteOverride({
        overrideRequested: true,
        overrideReason: 'Bypassing invalid workflow transition',
        overrideActorRole: 'dispatcher',
        blockedReasonCodes: ['WORKFLOW_INCOMPATIBLE'],
      }),
    ).toThrow();
  });
});
