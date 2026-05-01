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

  it('keeps production request bodies out of logs unless explicitly enabled', () => {
    expect(shouldLogRequestBody({ NODE_ENV: 'production' })).toBe(false);
    expect(
      shouldLogRequestBody({
        NODE_ENV: 'production',
        LOG_REQUEST_BODIES: 'true',
      }),
    ).toBe(true);
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
});
