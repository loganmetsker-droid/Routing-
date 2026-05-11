import { describe, expect, it } from 'vitest';
import { getMissingRuntimeConfig } from './runtime-config.util';

const baseHostedEnv = {
  NODE_ENV: 'staging',
  JWT_SECRET: 'configured',
  FRONTEND_URL: 'https://staging.example.test',
  DATABASE_URL: 'postgres://example.invalid/app',
  ROUTING_SERVICE_INTERNAL_TOKEN: 'configured',
};

describe('runtime config launch gates', () => {
  it('requires METRICS_TOKEN in staging', () => {
    expect(getMissingRuntimeConfig(baseHostedEnv as NodeJS.ProcessEnv)).toContain(
      'METRICS_TOKEN',
    );
  });

  it('requires METRICS_TOKEN in production', () => {
    expect(
      getMissingRuntimeConfig({
        ...baseHostedEnv,
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv),
    ).toContain('METRICS_TOKEN');
  });

  it('accepts hosted runtime config when metrics is token-protected', () => {
    expect(
      getMissingRuntimeConfig({
        ...baseHostedEnv,
        METRICS_TOKEN: 'configured',
      } as NodeJS.ProcessEnv),
    ).toEqual([]);
  });

  it('requires routing-service internal auth in hosted environments', () => {
    const missing = getMissingRuntimeConfig({
      ...baseHostedEnv,
      ROUTING_SERVICE_INTERNAL_TOKEN: '',
      METRICS_TOKEN: 'configured',
    } as NodeJS.ProcessEnv);

    expect(missing).toContain('ROUTING_SERVICE_INTERNAL_TOKEN');
  });
});
