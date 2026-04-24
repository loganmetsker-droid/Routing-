import { unwrapApiData, type Route as SharedRoute } from '@shared/contracts';
import { apiFetch } from './api.session';
import type { OptimizerHealth } from './api.types';

export const assignDriverToRouteLive = async (
  routeId: string,
  driverId: string,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ driverId }),
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(
    await response.json(),
  );
};

export const startRouteLive = async (
  routeId: string,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}/start`, {
    method: 'PATCH',
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(
    await response.json(),
  );
};

export const completeRouteLive = async (
  routeId: string,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}/complete`, {
    method: 'PATCH',
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(
    await response.json(),
  );
};

export const cancelRouteLive = async (
  routeId: string,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}/cancel`, {
    method: 'PATCH',
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(
    await response.json(),
  );
};

export const updateRouteLive = async (
  routeId: string,
  updates: Partial<SharedRoute>,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(
    await response.json(),
  );
};

export const reorderRouteStopsLive = async (
  routeId: string,
  newJobOrder: string[],
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  const response = await apiFetch(`/api/dispatch/routes/${routeId}/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ newJobOrder }),
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(
    await response.json(),
  );
};
