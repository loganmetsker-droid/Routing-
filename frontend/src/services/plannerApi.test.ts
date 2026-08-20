import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('./api.preview', () => ({
  isPreview: () => false,
  previewState: {
    jobs: [],
    routes: [],
    vehicles: [],
    drivers: [],
  },
}));

vi.mock('./api.session', () => ({ apiFetch }));

import {
  batchMoveRoutePlanStops,
  buildPreviewDriverFamiliarityResponse,
  getRoutePlanDriverFamiliarity,
  insertJobIntoRoutePlan,
} from './plannerApi';

describe('plannerApi planning mutation contracts', () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it('posts a job insertion to the selected route-plan group', async () => {
    apiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          routePlan: {
            id: 'plan-1',
            serviceDate: '2026-08-04',
            status: 'DRAFT',
            objective: 'balanced',
          },
          groups: [{ id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1' }],
          stops: [],
          unassignedJobs: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await insertJobIntoRoutePlan('plan-1', 'group-1', {
      jobId: 'job-1',
      targetSequence: 4,
    });

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/route-plans/plan-1/groups/group-1/insert-job',
      {
        method: 'POST',
        body: JSON.stringify({ jobId: 'job-1', targetSequence: 4 }),
      },
    );
    expect(result.plan).toMatchObject({ id: 'plan-1', status: 'DRAFT' });
    expect(result.groups).toHaveLength(1);
  });

  it('posts selected stops to the batch-move route-plan endpoint', async () => {
    apiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          routePlan: {
            id: 'plan-1',
            serviceDate: '2026-08-04',
            status: 'DRAFT',
            objective: 'balanced',
          },
          groups: [{ id: 'group-2', routePlanId: 'plan-1', groupIndex: 2, label: 'Route 2' }],
          stops: [],
          unassignedJobs: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await batchMoveRoutePlanStops('plan-1', {
      stopIds: ['stop-1', 'stop-2'],
      targetGroupId: 'group-2',
      targetSequence: 3,
    });

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/route-plans/plan-1/stops/batch-move',
      {
        method: 'POST',
        body: JSON.stringify({
          stopIds: ['stop-1', 'stop-2'],
          targetGroupId: 'group-2',
          targetSequence: 3,
        }),
      },
    );
    expect(result.plan).toMatchObject({ id: 'plan-1', status: 'DRAFT' });
    expect(result.groups[0]?.id).toBe('group-2');
  });

  it('loads evidence-backed driver familiarity for a route plan', async () => {
    apiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          source: 'completed_route_history',
          routePlanId: 'plan-1',
          serviceDate: '2026-08-04',
          lookbackDays: 365,
          radiusKm: 2,
          thresholds: { minimumCompletedRoutes: 2, minimumServicedStops: 5 },
          history: { completedRouteCount: 8, servicedLocatedStopCount: 42, routeLimitReached: false },
          recommendations: [{
            groupId: 'group-1',
            locatedStopCount: 10,
            status: 'supported',
            recommendedDriverId: 'driver-1',
            candidates: [],
          }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await getRoutePlanDriverFamiliarity('plan-1');

    expect(apiFetch).toHaveBeenCalledWith('/api/route-plans/plan-1/driver-familiarity');
    expect(result).toMatchObject({
      source: 'completed_route_history',
      radiusKm: 2,
      recommendations: [{ recommendedDriverId: 'driver-1' }],
    });
  });

  it('builds preview familiarity from the active route-day groups and drivers', () => {
    const result = buildPreviewDriverFamiliarityResponse('dense-plan', {
      serviceDate: '2026-06-03',
      groups: [{ id: 'dense-route-1' }, { id: 'dense-route-2' }],
      stops: Array.from({ length: 10 }, () => ({
        routePlanGroupId: 'dense-route-1',
      })),
      driverIds: ['dense-driver-1', 'dense-driver-2'],
    });

    expect(result.recommendations[0]).toMatchObject({
      groupId: 'dense-route-1',
      status: 'supported',
      recommendedDriverId: 'dense-driver-2',
      locatedStopCount: 10,
    });
    expect(result.recommendations[0]?.candidates).toContainEqual(
      expect.objectContaining({
        driverId: 'dense-driver-2',
        eligible: true,
        bars: 3,
      }),
    );
  });
});
