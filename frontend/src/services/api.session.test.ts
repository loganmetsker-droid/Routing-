import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAuthSession,
  setAuthToken,
  validateSessionState,
} from './api.session';

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => store.clear()),
  };
}

const mockSessionResponse = {
  data: {
    user: {
      id: 'user-1',
      email: 'operator@trovan.local',
      role: 'dispatcher',
      roles: ['DISPATCHER'],
    },
  },
  meta: {},
  error: null,
};

describe('auth session validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', {
      localStorage: storage,
      location: new URL('http://127.0.0.1:5194/dashboard'),
    } as unknown as Window & typeof globalThis);
  });

  afterEach(() => {
    clearAuthSession();
    vi.unstubAllGlobals();
  });

  it.each([408, 429, 503])(
    'keeps a valid token during transient auth status %s',
    async (status) => {
      setAuthToken('valid-token');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ message: 'Session check unavailable' }), {
            status,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      );

      await expect(validateSessionState()).resolves.toEqual(
        expect.objectContaining({ status: 'transient' }),
      );
      expect(localStorage.getItem('authToken')).toBe('valid-token');
    },
  );

  it.each([401, 403])('clears the token for strict auth status %s', async (status) => {
    setAuthToken('invalid-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Auth rejected' }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(validateSessionState()).resolves.toEqual(
      expect.objectContaining({ status: 'invalid' }),
    );
    expect(localStorage.getItem('authToken')).toBeNull();
  });

  it('confirms a valid session when /api/auth/me succeeds', async () => {
    setAuthToken('valid-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockSessionResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(validateSessionState()).resolves.toEqual(
      expect.objectContaining({ status: 'valid' }),
    );
    expect(localStorage.getItem('authToken')).toBe('valid-token');
  });
});
