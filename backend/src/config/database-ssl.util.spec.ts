import { describe, expect, it } from 'vitest';
import { resolveDatabaseSsl } from './database-ssl.util';

describe('resolveDatabaseSsl', () => {
  it('trusts the bundled Supabase CA while keeping verification enabled', () => {
    const ssl = resolveDatabaseSsl({
      databaseUrl:
        'postgres://user:password@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
      nodeEnv: 'production',
    });

    expect(ssl).not.toBe(false);
    expect(ssl && ssl.rejectUnauthorized).toBe(true);
    expect(ssl && ssl.ca).toContain('BEGIN CERTIFICATE');
  });

  it('does not use TLS for a local development database', () => {
    expect(
      resolveDatabaseSsl({
        databaseUrl: 'postgres://localhost:5432/trovan',
        nodeEnv: 'development',
      }),
    ).toBe(false);
  });

  it('requires an explicit escape hatch before accepting self-signed TLS', () => {
    expect(
      resolveDatabaseSsl({
        allowSelfSigned: true,
        databaseUrl: 'postgres://db.example.test:5432/trovan',
        nodeEnv: 'production',
      }),
    ).toEqual({ rejectUnauthorized: false });
  });
});
