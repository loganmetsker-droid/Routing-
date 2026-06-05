import { describe, expect, it } from 'vitest';
import {
  extractJwtFromAuthHeader,
  MAX_JWT_BEARER_TOKEN_LENGTH,
} from './jwt.strategy';

describe('extractJwtFromAuthHeader', () => {
  it('extracts a bearer token from the Authorization header', () => {
    const token = 'header.payload.signature';
    expect(
      extractJwtFromAuthHeader({
        headers: { authorization: `Bearer ${token}` },
      }),
    ).toBe(token);
  });

  it('returns null when the bearer token exceeds the configured length cap', () => {
    const token = 'a'.repeat(MAX_JWT_BEARER_TOKEN_LENGTH + 1);
    expect(
      extractJwtFromAuthHeader({
        headers: { authorization: `Bearer ${token}` },
      }),
    ).toBeNull();
  });

  it('supports array-valued authorization headers', () => {
    const token = 'header.payload.signature';
    expect(
      extractJwtFromAuthHeader({
        headers: {
          authorization: [
            `Bearer ${token}`,
            'Bearer should-not-be-used',
          ],
        },
      }),
    ).toBe(token);
  });
});

