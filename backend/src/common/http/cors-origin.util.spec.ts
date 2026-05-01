import { describe, expect, it } from 'vitest';
import {
  createCorsOriginValidator,
  parseAllowedOriginsFromEnv,
} from './cors-origin.util';

function runValidator(
  validator: ReturnType<typeof createCorsOriginValidator>,
  origin: string | undefined,
) {
  return new Promise<{ err: Error | null; allowed: boolean | undefined }>(
    (resolve) => {
      validator(origin, (err, allowed) => resolve({ err, allowed }));
    },
  );
}

describe('parseAllowedOriginsFromEnv', () => {
  it('splits and trims comma-separated origins', () => {
    expect(
      parseAllowedOriginsFromEnv({
        NODE_ENV: 'development',
        CORS_ORIGINS: ' http://a.test ,http://b.test, ',
      } as any),
    ).toEqual(['http://a.test', 'http://b.test']);
  });
});

describe('createCorsOriginValidator', () => {
  it('allows requests without an Origin header', async () => {
    const validator = createCorsOriginValidator({
      env: { NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example.com' } as any,
    });

    const result = await runValidator(validator, undefined);
    expect(result.err).toBeNull();
    expect(result.allowed).toBe(true);
  });

  it('allows known local origins when unconfigured in dev', async () => {
    const validator = createCorsOriginValidator({
      env: { NODE_ENV: 'development' } as any,
    });

    const result = await runValidator(validator, 'http://localhost:5173');
    expect(result.err).toBeNull();
    expect(result.allowed).toBe(true);
  });

  it('blocks unknown origins when unconfigured in dev', async () => {
    const validator = createCorsOriginValidator({
      env: { NODE_ENV: 'development' } as any,
    });

    const result = await runValidator(validator, 'https://evil.example');
    expect(result.err).toBeInstanceOf(Error);
    expect(result.allowed).toBe(false);
  });

  it('enforces configured allowlist in production', async () => {
    const validator = createCorsOriginValidator({
      env: { NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example.com' } as any,
    });

    const allowed = await runValidator(validator, 'https://app.example.com');
    expect(allowed.err).toBeNull();
    expect(allowed.allowed).toBe(true);

    const blocked = await runValidator(validator, 'https://evil.example');
    expect(blocked.err).toBeInstanceOf(Error);
    expect(blocked.allowed).toBe(false);
  });
});

