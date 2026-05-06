import { describe, expect, it, vi } from 'vitest';
import {
  authenticateSocket,
  extractSocketBearerToken,
  socketOrganizationRoom,
} from './socket-auth.util';

function socketWithHandshake(handshake: any) {
  return { handshake } as any;
}

describe('socket auth utilities', () => {
  it('extracts tokens from Socket.IO auth payloads', () => {
    expect(
      extractSocketBearerToken(
        socketWithHandshake({ auth: { token: 'Bearer abc123' }, headers: {}, query: {} }),
      ),
    ).toBe('abc123');
  });

  it('falls back to Authorization headers', () => {
    expect(
      extractSocketBearerToken(
        socketWithHandshake({
          auth: {},
          headers: { authorization: 'Bearer header-token' },
          query: {},
        }),
      ),
    ).toBe('header-token');
  });

  it('requires organization scope after JWT verification', async () => {
    const jwtService = {
      verifyAsync: vi.fn(async () => ({ sub: 'user-1', email: 'u@test.dev' })),
    } as any;

    await expect(
      authenticateSocket(
        jwtService,
        socketWithHandshake({ auth: { token: 'token' }, headers: {}, query: {} }),
      ),
    ).rejects.toThrow('organization scope');
  });

  it('returns normalized auth context for scoped JWTs', async () => {
    const jwtService = {
      verifyAsync: vi.fn(async () => ({
        sub: 'user-1',
        email: 'u@test.dev',
        organizationId: 'org-1',
        roles: ['dispatcher'],
      })),
    } as any;

    await expect(
      authenticateSocket(
        jwtService,
        socketWithHandshake({ auth: { token: 'Bearer token' }, headers: {}, query: {} }),
      ),
    ).resolves.toMatchObject({
      token: 'token',
      userId: 'user-1',
      organizationId: 'org-1',
      roles: ['DISPATCHER'],
    });
  });

  it('builds stable organization room names', () => {
    expect(socketOrganizationRoom('tracking', 'org-1', 'locations')).toBe(
      'tracking:org:org-1:locations',
    );
  });
});
