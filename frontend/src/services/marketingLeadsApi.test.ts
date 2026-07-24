import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMarketingLeadAccess } from './marketingLeadsApi';

describe('marketingLeadsApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('checks platform-operator access before the lead list query is enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            operatorAccess: false,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: () => 'token-123',
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    });

    await expect(getMarketingLeadAccess()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/api/marketing-leads/access',
    );
  });
});
