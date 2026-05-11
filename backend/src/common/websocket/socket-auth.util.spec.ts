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

  it('treats JWT verification failures as unauthorized', async () => {
    const jwtService = {
      verifyAsync: vi.fn(async () => {
        throw new Error('invalid jwt');
      }),
    } as any;

    await expect(
      authenticateSocket(
        jwtService,
        socketWithHandshake({ auth: { token: 'token' }, headers: {}, query: {} }),
      ),
    ).rejects.toThrow('Invalid socket authentication token');
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

  it('rejects revoked sessions when a session repository is provided', async () => {
    const jwtService = {
      verifyAsync: vi.fn(async () => ({
        sub: 'user-1',
        sid: 'session-1',
        organizationId: 'org-1',
      })),
    } as any;
    const authSessions = {
      findOne: vi.fn(async () => ({
        id: 'session-1',
        userId: 'user-1',
        organizationId: 'org-1',
        revokedAt: new Date(),
      })),
      save: vi.fn(),
    };

    await expect(
      authenticateSocket(
        jwtService,
        socketWithHandshake({ auth: { token: 'token' }, headers: {}, query: {} }),
        authSessions as any,
      ),
    ).rejects.toThrow('session has expired');
  });

  it('requires the session organization to match the JWT organization', async () => {
    const jwtService = {
      verifyAsync: vi.fn(async () => ({
        sub: 'user-1',
        sid: 'session-1',
        organizationId: 'org-1',
      })),
    } as any;
    const authSessions = {
      findOne: vi.fn(async () => ({
        id: 'session-1',
        userId: 'user-1',
        organizationId: 'org-2',
        revokedAt: null,
      })),
      save: vi.fn(),
    };

    await expect(
      authenticateSocket(
        jwtService,
        socketWithHandshake({ auth: { token: 'token' }, headers: {}, query: {} }),
        authSessions as any,
      ),
    ).rejects.toThrow('session has expired');
  });

  it('accepts an active session and updates last seen', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      organizationId: 'org-1',
      revokedAt: null,
      lastSeenAt: null,
    };
    const jwtService = {
      verifyAsync: vi.fn(async () => ({
        sub: 'user-1',
        sid: 'session-1',
        organizationId: 'org-1',
      })),
    } as any;
    const authSessions = {
      findOne: vi.fn(async () => session),
      save: vi.fn(async (value) => value),
    };

    await expect(
      authenticateSocket(
        jwtService,
        socketWithHandshake({ auth: { token: 'token' }, headers: {}, query: {} }),
        authSessions as any,
      ),
    ).resolves.toMatchObject({ sessionId: 'session-1' });
    expect(session.lastSeenAt).toBeInstanceOf(Date);
    expect(authSessions.save).toHaveBeenCalledWith(session);
  });

  it('builds stable organization room names', () => {
    expect(socketOrganizationRoom('tracking', 'org-1', 'locations')).toBe(
      'tracking:org:org-1:locations',
    );
  });
});
