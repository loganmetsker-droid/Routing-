import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicTracking } from './publicTrackingApi';

describe('publicTrackingApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes the public tracking payload from the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            organization: {
              id: 'org-1',
              name: 'Acme Routing',
              slug: 'acme-routing',
              branding: {
                brandName: 'Acme Routing',
                primaryColor: '#1F1A17',
              },
            },
            routeRun: {
              id: 'route-1',
              status: 'in_progress',
              workflowStatus: 'in_progress',
              vehicleId: 'vehicle-1',
              jobCount: 2,
            },
            stops: [
              {
                id: 'stop-1',
                stopSequence: 1,
                status: 'ARRIVED',
              },
            ],
            vehicle: {
              id: 'vehicle-1',
              make: 'Ford',
              model: 'Transit',
              licensePlate: 'ABC-123',
            },
            latestTelemetry: {
              latitude: 39.75,
              longitude: -104.99,
              timestamp: '2026-04-21T18:15:00.000Z',
            },
            expiresAt: '2026-04-28T18:15:00.000Z',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const tracking = await getPublicTracking('share-token');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/public/tracking/share-token'),
      expect.objectContaining({
        credentials: 'include',
      }),
    );
    expect(tracking.organization.branding.brandName).toBe('Acme Routing');
    expect(tracking.routeRun.status).toBe('in_progress');
    expect(tracking.vehicle?.licensePlate).toBe('ABC-123');
    expect(tracking.stops[0].status).toBe('ARRIVED');
  });
});
