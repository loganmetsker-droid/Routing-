import { describe, expect, it } from 'vitest';
import { resolveTrovanDataMode, usesPreviewDataMode } from './dataMode';

describe('resolveTrovanDataMode', () => {
  it('keeps localhost on live data unless preview is explicitly requested', () => {
    const mode = resolveTrovanDataMode({
      env: {
        DEV: true,
        VITE_AUTH_BYPASS: 'true',
        VITE_MOCK_PREVIEW: 'false',
      },
      location: new URL('http://127.0.0.1:5194/dashboard'),
      hasPreviewBootstrap: false,
    });

    expect(mode).toBe('live');
    expect(usesPreviewDataMode(mode)).toBe(false);
  });

  it('supports explicit preview and simulated modes', () => {
    expect(
      resolveTrovanDataMode({
        env: {},
        location: new URL('http://127.0.0.1:5194/dashboard?workspaceMode=preview'),
      }),
    ).toBe('preview');

    const simulated = resolveTrovanDataMode({
      env: {},
      location: new URL('http://127.0.0.1:5194/dashboard?dataMode=simulated'),
    });

    expect(simulated).toBe('simulated');
    expect(usesPreviewDataMode(simulated)).toBe(true);
  });

  it('maps production workspace and legacy live auth overrides to live mode', () => {
    expect(
      resolveTrovanDataMode({
        env: { VITE_MOCK_PREVIEW: 'true' },
        location: new URL('http://trovan.localhost:5194/dashboard?workspaceMode=production'),
      }),
    ).toBe('live');

    expect(
      resolveTrovanDataMode({
        env: { VITE_MOCK_PREVIEW: 'true' },
        location: new URL('http://127.0.0.1:5194/dashboard?auth=live'),
      }),
    ).toBe('live');
  });
});
