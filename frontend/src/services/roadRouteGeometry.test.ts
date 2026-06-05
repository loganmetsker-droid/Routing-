import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRoadRoutePolyline, getRoadRouteSignature } from './roadRouteGeometry';

describe('roadRouteGeometry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a stable rounded coordinate signature', () => {
    expect(
      getRoadRouteSignature([
        [-104.99031234, 39.73924567],
        [-105.27050002, 40.01499999],
      ]),
    ).toBe('-104.990312,39.739246;-105.2705,40.015');
  });

  it('returns road-following geometry from the OSRM response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [
            {
              geometry: {
                coordinates: [
                  [-104.99, 39.73],
                  [-104.98, 39.74],
                  [-104.97, 39.75],
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const geometry = await fetchRoadRoutePolyline([
      [-104.99, 39.73],
      [-104.97, 39.75],
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://router.project-osrm.org/route/v1/driving/-104.99,39.73;-104.97,39.75',
      ),
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    expect(geometry).toEqual([
      [-104.99, 39.73],
      [-104.98, 39.74],
      [-104.97, 39.75],
    ]);
  });

  it('returns null when there are not enough route points', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchRoadRoutePolyline([[-104.99, 39.73]])).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
