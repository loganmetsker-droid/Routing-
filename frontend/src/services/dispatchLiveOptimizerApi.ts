import { apiFetch } from './api.session';
import type {
  DispatchTimelineEvent,
  OptimizerEvent,
  OptimizerHealth,
} from './api.types';
import { getLatestOptimizerHealth, setLatestOptimizerHealth } from './dispatchShared';

export const getDispatchOptimizerHealthLive = async (): Promise<OptimizerHealth | null> => {
  try {
    const response = await apiFetch('/api/dispatch/optimizer/health');
    const data = (await response.json()) as OptimizerHealth;
    if (data?.status) {
      setLatestOptimizerHealth(data);
      return data;
    }
    return getLatestOptimizerHealth();
  } catch (error) {
    console.error('Error fetching optimizer health:', error);
    return getLatestOptimizerHealth();
  }
};

export const getDispatchOptimizerEventsLive = async (
  limit = 20,
): Promise<OptimizerEvent[]> => {
  try {
    const response = await apiFetch(`/api/dispatch/optimizer/events?limit=${limit}`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.events || [];
  } catch (error) {
    console.error('Error fetching optimizer events:', error);
    return [];
  }
};

export const getDispatchTimelineLive = async (
  params: {
    routeId?: string;
    limit?: number;
    reasonCode?: string;
    action?: string;
    actor?: string;
    source?: 'optimizer' | 'reroute' | 'workflow' | 'system';
    before?: string;
    packId?: string;
  } = {},
): Promise<DispatchTimelineEvent[]> => {
  try {
    const search = new URLSearchParams();
    if (params.routeId) search.set('routeId', params.routeId);
    if (params.limit) search.set('limit', String(params.limit));
    if (params.reasonCode) search.set('reasonCode', params.reasonCode);
    if (params.action) search.set('action', params.action);
    if (params.actor) search.set('actor', params.actor);
    if (params.source) search.set('source', params.source);
    if (params.before) search.set('before', params.before);
    if (params.packId) search.set('packId', params.packId);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const response = await apiFetch(`/api/dispatch/timeline${suffix}`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.events || [];
  } catch (error) {
    console.error('Error fetching dispatch timeline:', error);
    return [];
  }
};
