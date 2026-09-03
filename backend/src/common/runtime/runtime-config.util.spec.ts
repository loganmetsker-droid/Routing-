import { describe, expect, it } from 'vitest';
import {
  getMissingCoreRuntimeConfig,
  getMissingPilotIntegrationConfig,
  getMissingRuntimeConfig,
  requiresCompletePilotConfig,
} from './runtime-config.util';

const baseHostedEnv = {
  NODE_ENV: 'staging',
  JWT_SECRET: 'configured',
  FRONTEND_URL: 'https://staging.example.test',
  DATABASE_URL: 'postgres://example.invalid/app',
  ROUTING_SERVICE_INTERNAL_TOKEN: 'configured',
  GEOCODING_PROVIDER: 'mapbox',
  GEOCODING_API_KEY: 'configured',
  ERROR_MONITORING_WEBHOOK_URL: 'https://monitoring.example.test/events',
  ACCESS_CODE_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
  POSTMARK_SERVER_TOKEN: 'configured',
  POSTMARK_FROM_EMAIL: 'notifications@example.test',
  LEAD_INTAKE_EMAIL: 'operator@example.test',
  LEAD_INTAKE_FROM_EMAIL: 'notifications@example.test',
  POSTMARK_WEBHOOK_USERNAME: 'postmark',
  POSTMARK_WEBHOOK_PASSWORD: 'configured',
  POSTMARK_BOUNCE_HASH_KEY: 'a'.repeat(32),
};

describe('runtime config launch gates', () => {
  it('keeps optional pilot integrations out of the core startup gate', () => {
    const env = {
      NODE_ENV: 'production',
      JWT_SECRET: 'configured',
      FRONTEND_URL: 'https://trytrovan.com',
      DATABASE_URL: 'postgres://example.invalid/app',
      METRICS_TOKEN: 'configured',
      ROUTING_SERVICE_INTERNAL_TOKEN: 'configured',
    } as NodeJS.ProcessEnv;

    expect(getMissingCoreRuntimeConfig(env)).toEqual([]);
    expect(getMissingPilotIntegrationConfig(env)).toContain(
      'POSTMARK_SERVER_TOKEN',
    );
  });

  it('requires explicit opt-in to make incomplete pilot integrations fatal', () => {
    expect(requiresCompletePilotConfig({})).toBe(false);
    expect(
      requiresCompletePilotConfig({ REQUIRE_COMPLETE_PILOT_CONFIG: 'true' }),
    ).toBe(true);
  });

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

  it('requires a production geocoder in hosted environments', () => {
    const missing = getMissingRuntimeConfig({
      ...baseHostedEnv,
      METRICS_TOKEN: 'configured',
      GEOCODING_PROVIDER: 'nominatim',
      GEOCODING_API_KEY: '',
    } as NodeJS.ProcessEnv);

    expect(missing).toContain('GEOCODING_PROVIDER=mapbox');
    expect(missing).toContain('GEOCODING_API_KEY');
  });

  it('requires error monitoring in hosted environments', () => {
    const missing = getMissingRuntimeConfig({
      ...baseHostedEnv,
      METRICS_TOKEN: 'configured',
      ERROR_MONITORING_WEBHOOK_URL: '',
    } as NodeJS.ProcessEnv);

    expect(missing).toContain('ERROR_MONITORING_WEBHOOK_URL');
  });

  it('requires authenticated Postmark bounce handling in hosted environments', () => {
    const missing = getMissingRuntimeConfig({
      ...baseHostedEnv,
      METRICS_TOKEN: 'configured',
      POSTMARK_WEBHOOK_PASSWORD: '',
      POSTMARK_BOUNCE_HASH_KEY: 'short',
    } as NodeJS.ProcessEnv);

    expect(missing).toContain('POSTMARK_WEBHOOK_PASSWORD');
    expect(missing).toContain('POSTMARK_BOUNCE_HASH_KEY (at least 32 characters)');
  });

  it('requires a valid access-code encryption key in hosted environments', () => {
    const missing = getMissingRuntimeConfig({
      ...baseHostedEnv,
      METRICS_TOKEN: 'configured',
      ACCESS_CODE_ENCRYPTION_KEY: 'too-short',
    } as NodeJS.ProcessEnv);

    expect(missing).toContain(
      'ACCESS_CODE_ENCRYPTION_KEY (32-byte base64 or 64-char hex)',
    );
  });
});
