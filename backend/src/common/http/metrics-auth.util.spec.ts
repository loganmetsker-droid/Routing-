import { describe, expect, it } from 'vitest';
import {
  extractMetricsToken,
  isMetricsRequestAuthorized,
  isMetricsTokenConfigured,
} from './metrics-auth.util';

describe('metrics auth util', () => {
  it('treats metrics as public when METRICS_TOKEN is unset', () => {
    expect(isMetricsTokenConfigured({})).toBe(false);
    expect(isMetricsRequestAuthorized({}, {})).toEqual({
      authorized: true,
      tokenRequired: false,
    });
  });

  it('accepts Authorization: Bearer <token>', () => {
    expect(
      extractMetricsToken({
        authorization: 'Bearer secret-token',
      }),
    ).toBe('secret-token');
  });

  it('accepts x-metrics-token header', () => {
    expect(
      extractMetricsToken({
        'x-metrics-token': 'secret-token',
      }),
    ).toBe('secret-token');
  });

  it('denies when a token is configured but not provided', () => {
    expect(isMetricsRequestAuthorized({}, { METRICS_TOKEN: 'secret-token' })).toEqual({
      authorized: false,
      tokenRequired: true,
    });
  });

  it('denies when a token is configured and mismatched', () => {
    expect(
      isMetricsRequestAuthorized(
        { authorization: 'Bearer wrong-token' },
        { METRICS_TOKEN: 'secret-token' },
      ).authorized,
    ).toBe(false);
  });

  it('authorizes when a token is configured and matches', () => {
    expect(
      isMetricsRequestAuthorized(
        { authorization: 'Bearer secret-token' },
        { METRICS_TOKEN: 'secret-token' },
      ),
    ).toEqual({ authorized: true, tokenRequired: true });
  });
});
