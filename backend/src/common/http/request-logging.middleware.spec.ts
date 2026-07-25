import {
  isSensitiveKey,
  sanitizeBody,
  sanitizePath,
  shouldLogRequestBody,
} from './request-logging.middleware';

describe('request logging sanitizers', () => {
  it('redacts common sensitive body keys regardless of casing or key style', () => {
    expect(
      sanitizeBody({
        email: 'admin@example.com',
        accessToken: 'jwt',
        api_key: 'trovan_secret',
        StripeSignature: 'signature',
        paymentMethodId: 'pm_123',
        nested: {
          customerPhone: '555-0101',
          note: 'leave at dock',
        },
      }),
    ).toEqual({
      email: '[REDACTED]',
      accessToken: '[REDACTED]',
      api_key: '[REDACTED]',
      StripeSignature: '[REDACTED]',
      paymentMethodId: '[REDACTED]',
      nested: {
        customerPhone: '[REDACTED]',
        note: 'leave at dock',
      },
    });
  });

  it('redacts sensitive keys inside arrays without dropping safe fields', () => {
    expect(
      sanitizeBody({
        stops: [
          { address: '100 Main St', customerEmail: 'shipper@example.com' },
          { address: '200 Oak St', proofToken: 'signed-token' },
        ],
      }),
    ).toEqual({
      stops: [
        { address: '100 Main St', customerEmail: '[REDACTED]' },
        { address: '200 Oak St', proofToken: '[REDACTED]' },
      ],
    });
  });

  it('preserves hostile property names as inert own properties', () => {
    const body = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"secret":"value"},"safe":"ok"}',
    );
    const sanitized = sanitizeBody(body) as Record<string, unknown>;

    expect(Object.prototype.hasOwnProperty.call(sanitized, '__proto__')).toBe(
      true,
    );
    expect(Object.prototype.hasOwnProperty.call(sanitized, 'constructor')).toBe(
      true,
    );
    expect(sanitized.safe).toBe('ok');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('sanitizes UUIDs from request paths', () => {
    expect(
      sanitizePath('/api/jobs/018f3b8d-4d2f-4a56-9a2b-123456789abc'),
    ).toBe('/api/jobs/:uuid');
  });

  it('strips query strings and hashes from request paths', () => {
    expect(
      sanitizePath(
        '/api/jobs/018f3b8d-4d2f-4a56-9a2b-123456789abc?token=secret#section',
      ),
    ).toBe('/api/jobs/:uuid');
  });

  it('redacts public tracking tokens from request paths to avoid leaking them in logs', () => {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJraW5kIjoicHVibGljLXRyYWNraW5nIiwicm91dGVJZCI6IjEyMyIsImV4cCI6MTcwMDAwMDAwMH0.dGhpcy1pcy1ub3QtYS1yZWFsLXNpZ25hdHVyZQ';
    expect(sanitizePath(`/api/public/tracking/${token}`)).toBe(
      '/api/public/tracking/:token',
    );
  });

  it('keeps production request bodies out of logs unless explicitly enabled', () => {
    expect(shouldLogRequestBody({ NODE_ENV: 'production' })).toBe(false);
    expect(
      shouldLogRequestBody({
        NODE_ENV: 'production',
        LOG_REQUEST_BODIES: 'true',
      }),
    ).toBe(true);
    expect(shouldLogRequestBody({ NODE_ENV: 'development' })).toBe(false);
    expect(
      shouldLogRequestBody({
        NODE_ENV: 'development',
        LOG_REQUEST_BODIES: 'false',
      }),
    ).toBe(false);
  });

  it('classifies known sensitive keys', () => {
    expect(isSensitiveKey('authorization')).toBe(true);
    expect(isSensitiveKey('customer_phone')).toBe(true);
    expect(isSensitiveKey('routeId')).toBe(false);
  });

  it('truncates deeply nested bodies to cap log processing cost', () => {
    const deep = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: {
                  level7: {
                    level8: {
                      level9: {
                        level10: { ok: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    expect(sanitizeBody(deep)).toEqual({
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: {
                  level7: {
                    level8: '[TRUNCATED]',
                  },
                },
              },
            },
          },
        },
      },
    });
  });

  it('avoids serializing binary bodies into logs', () => {
    expect(sanitizeBody(Buffer.from('hello'))).toBe('[BINARY]');
    expect(sanitizeBody(new Uint8Array([1, 2, 3]))).toBe('[BINARY]');
  });

  it('truncates overly large strings and arrays to cap log size', () => {
    expect(sanitizeBody({ note: 'a'.repeat(3000) })).toEqual({
      note: '[TRUNCATED]',
    });
    expect(sanitizeBody({ values: Array.from({ length: 150 }, (_, i) => i) })).toEqual({
      values: '[TRUNCATED]',
    });
  });
});
