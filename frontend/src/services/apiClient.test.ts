import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiFetch,
  clearAuthToken,
  setAuthToken,
} from './apiClient';

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

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('window', {} as Window & typeof globalThis);
    vi.stubGlobal('localStorage', createStorage());
  });

  afterEach(() => {
    clearAuthToken();
  });

  it('adds bearer auth and credentials to authenticated requests', async () => {
    setAuthToken('token-123');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const data = await apiFetch<{ ok: boolean }>('/api/dispatch/routes');

    expect(data).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(init?.credentials).toBe('include');
  });

  it('throws ApiError with parsed response details on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/dispatch/routes/route-1/start')).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: 'ApiError',
        message: 'Insufficient permissions',
        status: 403,
      }),
    );
  });
});
