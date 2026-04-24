import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAuditOverview } from './auditApi';

describe('auditApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes audit overview payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            generatedAt: '2026-04-21T18:10:00.000Z',
            controls: {
              requestIdsEnabled: true,
              structuredRequestLogging: true,
              sensitiveFieldRedaction: true,
              authMode: 'jwt',
              auditRetentionDays: 90,
              dispatchEventRetentionDays: 90,
            },
            counts: {
              totalEntries: 15,
              last24hEntries: 5,
              last7dEntries: 11,
            },
            actionBreakdown: [
              { action: 'route-run.started', count: 3 },
            ],
            recentEntries: [
              {
                id: 'audit-1',
                actorId: 'user-1',
                actorType: 'user',
                entityType: 'route_run',
                entityId: 'route-1',
                action: 'route-run.started',
                source: 'user',
                createdAt: '2026-04-21T18:00:00.000Z',
              },
            ],
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

    const overview = await getAuditOverview();

    expect(overview.controls.authMode).toBe('jwt');
    expect(overview.counts.last24hEntries).toBe(5);
    expect(overview.actionBreakdown[0].action).toBe('route-run.started');
    expect(overview.recentEntries[0].entityId).toBe('route-1');
  });
});
