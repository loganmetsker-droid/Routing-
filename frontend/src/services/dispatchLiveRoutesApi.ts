import {
  unwrapApiData,
  unwrapListItems,
  type ManualRouteCreationRequest,
  type Route as SharedRoute,
} from '@shared/contracts';
import { apiFetch } from './api.session';
import type { OptimizerHealth, RouteRecord } from './api.types';
import {
  sanitizeRoute,
  setLatestOptimizerHealth,
} from './dispatchShared';
import { isRecord } from './api.types';

export const createRouteLive = async (
  route: ManualRouteCreationRequest,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  const response = await apiFetch('/api/dispatch/routes', {
    method: 'POST',
    body: JSON.stringify(route),
  });
  return unwrapApiData<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }>(
    await response.json(),
  );
};

export const generateGlobalRouteLive = async (
  vehicleIds: string[],
  jobIds: string[],
): Promise<SharedRoute[]> => {
  const response = await apiFetch('/api/dispatch/routes/global', {
    method: 'POST',
    body: JSON.stringify({ vehicleIds, jobIds }),
  });
  const data = await response.json();
  return unwrapListItems<SharedRoute>(data, ['routes', 'items']);
};

export const getRoutesLive = async (): Promise<RouteRecord[]> => {
  const response = await apiFetch('/api/dispatch/routes');
  const data = await response.json();
  if (isRecord(data) && data.optimizerHealth) {
    setLatestOptimizerHealth(data.optimizerHealth as OptimizerHealth);
  }
  return unwrapListItems<unknown>(data, ['routes', 'items']).map(sanitizeRoute);
};
