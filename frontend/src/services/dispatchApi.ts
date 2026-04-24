import type { Route as SharedRoute } from '@shared/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isPreview } from './api.preview';
import type {
  DispatchTimelineEvent,
  JsonRecord,
  OptimizerEvent,
  OptimizerHealth,
  ReroutePreview,
  RerouteRequest,
  RouteRecord,
} from './api.types';
import { queryKeys } from './queryKeys';
import {
  assignDriverToRouteLive,
  cancelRouteLive,
  completeRouteLive,
  reorderRouteStopsLive,
  startRouteLive,
  updateRouteLive,
} from './dispatchLiveCommandsApi';
import {
  getDispatchOptimizerEventsLive,
  getDispatchOptimizerHealthLive,
  getDispatchTimelineLive,
} from './dispatchLiveOptimizerApi';
import {
  applyRerouteLive,
  approveRerouteLive,
  getRerouteHistoryLive,
  previewRerouteLive,
  rejectRerouteLive,
  requestRerouteLive,
} from './dispatchLiveReroutesApi';
import {
  createRouteLive,
  generateGlobalRouteLive,
  getRoutesLive,
} from './dispatchLiveRoutesApi';
import {
  applyReroutePreview,
  approveReroutePreview,
  assignDriverToRoutePreview,
  cancelRoutePreview,
  completeRoutePreview,
  createRoutePreview,
  generateGlobalRoutePreview,
  getDispatchOptimizerEventsPreview,
  getDispatchOptimizerHealthPreview,
  getDispatchTimelinePreview,
  getRerouteHistoryPreview,
  getRoutesPreview,
  previewReroutePreview,
  rejectReroutePreview,
  reorderRouteStopsPreview,
  requestReroutePreview,
  startRoutePreview,
  updateRoutePreview,
} from './dispatchPreviewApi';

export const createRoute = async (route: {
  vehicleId: string;
  jobIds: string[];
}): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> =>
  isPreview() ? createRoutePreview(route) : createRouteLive(route);

export const generateRoute = async (
  vehicleId: string,
  jobIds: string[],
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> =>
  createRoute({ vehicleId, jobIds });

export const generateGlobalRoute = async (
  vehicleIds: string[],
  jobIds: string[],
): Promise<SharedRoute[]> =>
  isPreview()
    ? generateGlobalRoutePreview(vehicleIds, jobIds)
    : generateGlobalRouteLive(vehicleIds, jobIds);

export const getRoutes = async (): Promise<RouteRecord[]> =>
  isPreview() ? getRoutesPreview() : getRoutesLive();

export const getDispatchOptimizerHealth = async (): Promise<OptimizerHealth | null> =>
  isPreview()
    ? getDispatchOptimizerHealthPreview()
    : getDispatchOptimizerHealthLive();

export const getDispatchOptimizerEvents = async (
  limit = 20,
): Promise<OptimizerEvent[]> =>
  isPreview()
    ? getDispatchOptimizerEventsPreview()
    : getDispatchOptimizerEventsLive(limit);

export const getDispatchTimeline = async (
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
): Promise<DispatchTimelineEvent[]> =>
  isPreview() ? getDispatchTimelinePreview(params) : getDispatchTimelineLive(params);

export const requestReroute = async (
  routeId: string,
  payload: {
    exceptionCategory: string;
    action: string;
    reason: string;
    requesterId?: string;
    requestPayload?: JsonRecord;
    plannerDiagnostics?: JsonRecord;
  },
): Promise<{ rerouteRequest: RerouteRequest; route: RouteRecord }> =>
  isPreview()
    ? requestReroutePreview(routeId, payload)
    : requestRerouteLive(routeId, payload);

export const approveReroute = async (
  routeId: string,
  requestId: string,
  payload: { reviewerId?: string; reviewNote?: string } = {},
): Promise<{ rerouteRequest: RerouteRequest; route: RouteRecord }> =>
  isPreview()
    ? approveReroutePreview(routeId, requestId, payload)
    : approveRerouteLive(routeId, requestId, payload);

export const rejectReroute = async (
  routeId: string,
  requestId: string,
  payload: { reviewerId?: string; reviewNote?: string } = {},
): Promise<{ rerouteRequest: RerouteRequest; route: RouteRecord }> =>
  isPreview()
    ? rejectReroutePreview(routeId, requestId, payload)
    : rejectRerouteLive(routeId, requestId, payload);

export const applyReroute = async (
  routeId: string,
  requestId: string,
  payload: {
    appliedBy?: string;
    appliedPayload?: JsonRecord;
    overrideRequested?: boolean;
    overrideReason?: string;
    overrideActor?: string;
    overrideActorRole?: string;
  } = {},
): Promise<{ rerouteRequest: RerouteRequest; route: RouteRecord }> =>
  isPreview()
    ? applyReroutePreview(routeId, requestId, payload)
    : applyRerouteLive(routeId, requestId, payload);

export const getRerouteHistory = async (
  routeId: string,
): Promise<RerouteRequest[]> =>
  isPreview() ? getRerouteHistoryPreview(routeId) : getRerouteHistoryLive(routeId);

export const previewReroute = async (
  routeId: string,
  payload: { action: string; payload?: JsonRecord },
): Promise<ReroutePreview | null> =>
  isPreview() ? previewReroutePreview(routeId, payload) : previewRerouteLive(routeId, payload);

export const assignDriverToRoute = async (
  routeId: string,
  driverId: string,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> =>
  isPreview()
    ? assignDriverToRoutePreview(routeId, driverId)
    : assignDriverToRouteLive(routeId, driverId);

export const startRoute = async (
  routeId: string,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> =>
  isPreview() ? startRoutePreview(routeId) : startRouteLive(routeId);

export const completeRoute = async (
  routeId: string,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> =>
  isPreview() ? completeRoutePreview(routeId) : completeRouteLive(routeId);

export const cancelRoute = async (
  routeId: string,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> =>
  isPreview() ? cancelRoutePreview(routeId) : cancelRouteLive(routeId);

export const updateRouteStatus = async (
  routeId: string,
  status: string,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> => {
  const normalizedStatus = status === 'dispatched' ? 'in_progress' : status;
  if (normalizedStatus === 'in_progress') {
    return startRoute(routeId);
  }
  if (normalizedStatus === 'completed') {
    return completeRoute(routeId);
  }
  if (normalizedStatus === 'cancelled') {
    return cancelRoute(routeId);
  }
  return updateRoute(routeId, { status: normalizedStatus });
};

export const updateRoute = async (
  routeId: string,
  updates: Partial<SharedRoute>,
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> =>
  isPreview() ? updateRoutePreview(routeId, updates) : updateRouteLive(routeId, updates);

export const reorderRouteStops = async (
  routeId: string,
  newJobOrder: string[],
): Promise<{ route: SharedRoute; optimizerHealth?: OptimizerHealth }> =>
  isPreview()
    ? reorderRouteStopsPreview(routeId, newJobOrder)
    : reorderRouteStopsLive(routeId, newJobOrder);

export const useRoutesQuery = () =>
  useQuery({
    queryKey: queryKeys.routes,
    queryFn: getRoutes,
  });

export const useDispatchOptimizerHealthQuery = () =>
  useQuery({
    queryKey: queryKeys.optimizerHealth,
    queryFn: getDispatchOptimizerHealth,
  });

export const useDispatchTimelineQuery = (
  params: Parameters<typeof getDispatchTimeline>[0] = {},
) =>
  useQuery({
    queryKey: queryKeys.dispatchTimeline({
      routeId: params.routeId,
      limit: params.limit,
      reasonCode: params.reasonCode,
      action: params.action,
      actor: params.actor,
      source: params.source,
      before: params.before,
      packId: params.packId,
    }),
    queryFn: () => getDispatchTimeline(params),
  });

export const useAssignDriverToRouteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, driverId }: { routeId: string; driverId: string }) =>
      assignDriverToRoute(routeId, driverId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.routes });
    },
  });
};

export const useUpdateRouteMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, updates }: { routeId: string; updates: Partial<SharedRoute> }) =>
      updateRoute(routeId, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.routes });
    },
  });
};
