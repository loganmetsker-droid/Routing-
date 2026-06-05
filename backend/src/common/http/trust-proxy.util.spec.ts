import { describe, expect, it } from 'vitest';
import { configureTrustProxy, parseTrustProxySetting } from './trust-proxy.util';

describe('parseTrustProxySetting', () => {
  it('returns undefined when unset', () => {
    expect(parseTrustProxySetting({} as any)).toBeUndefined();
    expect(parseTrustProxySetting({ TRUST_PROXY: '' } as any)).toBeUndefined();
  });

  it('parses boolean-ish values', () => {
    expect(parseTrustProxySetting({ TRUST_PROXY: 'true' } as any)).toBe(true);
    expect(parseTrustProxySetting({ TRUST_PROXY: 'on' } as any)).toBe(true);
    expect(parseTrustProxySetting({ TRUST_PROXY: 'false' } as any)).toBe(false);
    expect(parseTrustProxySetting({ TRUST_PROXY: 'off' } as any)).toBe(false);
  });

  it('parses hop counts', () => {
    expect(parseTrustProxySetting({ TRUST_PROXY: '1' } as any)).toBe(1);
    expect(parseTrustProxySetting({ TRUST_PROXY: '2' } as any)).toBe(2);
    expect(parseTrustProxySetting({ TRUST_PROXY: '0' } as any)).toBe(false);
    expect(parseTrustProxySetting({ TRUST_PROXY: '  3  ' } as any)).toBe(3);
  });

  it('clamps excessive hop counts', () => {
    expect(parseTrustProxySetting({ TRUST_PROXY: '99' } as any)).toBe(10);
  });

  it('ignores unknown values', () => {
    expect(parseTrustProxySetting({ TRUST_PROXY: 'maybe' } as any)).toBeUndefined();
    expect(parseTrustProxySetting({ TRUST_PROXY: '1.5' } as any)).toBeUndefined();
  });
});

describe('configureTrustProxy', () => {
  it('does not call app.set when unset', () => {
    const calls: Array<{ key: string; value: unknown }> = [];
    const app = { set: (key: string, value: unknown) => calls.push({ key, value }) };

    expect(configureTrustProxy(app, {} as any)).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it('sets trust proxy when configured', () => {
    const calls: Array<{ key: string; value: unknown }> = [];
    const app = { set: (key: string, value: unknown) => calls.push({ key, value }) };

    expect(configureTrustProxy(app, { TRUST_PROXY: '1' } as any)).toBe(1);
    expect(calls).toEqual([{ key: 'trust proxy', value: 1 }]);
  });
});
