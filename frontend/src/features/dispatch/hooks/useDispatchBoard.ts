import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../../services/apiClient';
import type { DispatchRoute } from '../../../types/dispatch';
import {
  assignRouteDriver,
  beginRoute,
  getDispatchBoardData,
  getRouteAuditTrail,
  getRouteVersions,
  markRouteApproved,
  markRouteReviewed,
  publishRoute,
  snapshotRoute,
} from '../api/dispatchApi';
import type { DispatchBoardState, DispatchRouteVersion } from '../types/dispatch';
import { getRouteExceptions, getUnassignedJobs } from '../utils/dispatchSelectors';
import { useDispatchRealtime } from './useDispatchRealtime';

const INITIAL_STATE: DispatchBoardState = {
  jobs: [],
  routes: [],
  vehicles: [],
  drivers: [],
  optimizerHealth: null,
  timeline: [],
  loading: true,
  refreshing: false,
  error: null,
  selectedRouteId: null,
  selectedRoute: null,
  selectedVersions: [],
  loadingVersions: false,
  mutationError: null,
  rerouteHistory: [],
};

function resolveError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Request failed';
}

function getLatestVersion(versions: DispatchRouteVersion[]) {
  return [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
}

export function useDispatchBoard() {
  const [state, setState] = useState<DispatchBoardState>(INITIAL_STATE);

  const refresh = useCallback(async (mode: 'initial' | 'refresh' = 'refresh') => {
    setState((current) => ({
      ...current,
      loading: mode === 'initial',
      refreshing: mode === 'refresh',
      error: null,
    }));

    try {
      const data = await getDispatchBoardData();
      setState((current) => {
        const selectedRouteId =
          current.selectedRouteId && data.routes.some((route) => route.id === current.selectedRouteId)
            ? current.selectedRouteId
            : data.routes[0]?.id ?? null;
        const selectedRoute =
          data.routes.find((route) => route.id === selectedRouteId) ?? null;

        return {
          ...current,
          ...data,
          loading: false,
          refreshing: false,
          error: null,
          selectedRouteId,
          selectedRoute,
        };
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        refreshing: false,
        error: resolveError(error),
      }));
    }
  }, []);

  useEffect(() => {
    void refresh('initial');
  }, [refresh]);

  const loadRouteContext = useCallback(
    async (routeId: string) => {
      setState((current) => ({
        ...current,
        selectedRouteId: routeId,
        selectedRoute: current.routes.find((route) => route.id === routeId) ?? null,
        loadingVersions: true,
        mutationError: null,
      }));

      try {
        const [versions, rerouteHistory] = await Promise.all([
          getRouteVersions(routeId),
          getRouteAuditTrail(routeId),
        ]);
        setState((current) => ({
          ...current,
          loadingVersions: false,
          selectedVersions: versions,
          rerouteHistory,
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          loadingVersions: false,
          mutationError: resolveError(error),
        }));
      }
    },
    [],
  );

  useEffect(() => {
    if (!state.selectedRouteId) return;
    void loadRouteContext(state.selectedRouteId);
  }, [loadRouteContext, state.selectedRouteId]);

  const runMutation = useCallback(
    async (operation: () => Promise<unknown>) => {
      setState((current) => ({ ...current, mutationError: null }));
      try {
        await operation();
        await refresh();
        if (state.selectedRouteId) {
          await loadRouteContext(state.selectedRouteId);
        }
      } catch (error) {
        setState((current) => ({
          ...current,
          mutationError: resolveError(error),
        }));
      }
    },
    [loadRouteContext, refresh, state.selectedRouteId],
  );

  useDispatchRealtime(() => {
    void refresh();
  });

  const selectedRoute = state.selectedRoute;
  const latestVersion = useMemo(
    () => getLatestVersion(state.selectedVersions),
    [state.selectedVersions],
  );

  const setSelectedRoute = useCallback((route: DispatchRoute) => {
    setState((current) => ({
      ...current,
      selectedRouteId: route.id,
      selectedRoute: route,
    }));
  }, []);

  return {
    ...state,
    selectedRoute,
    latestVersion,
    unassignedJobs: getUnassignedJobs(state.jobs),
    exceptions: getRouteExceptions(state.routes),
    refresh: () => refresh(),
    selectRoute: setSelectedRoute,
    snapshotRoute: async () => {
      const routeId = state.selectedRouteId;
      if (!routeId) return;
      await runMutation(() => snapshotRoute(routeId));
    },
    reviewLatestDraft: async () => {
      if (!state.selectedRouteId || !latestVersion) return;
      await runMutation(() => markRouteReviewed(state.selectedRouteId!, latestVersion.id));
    },
    approveLatestVersion: async () => {
      if (!state.selectedRouteId || !latestVersion) return;
      await runMutation(() => markRouteApproved(state.selectedRouteId!, latestVersion.id));
    },
    publishLatestVersion: async () => {
      if (!state.selectedRouteId || !latestVersion) return;
      await runMutation(() => publishRoute(state.selectedRouteId!, latestVersion.id));
    },
    assignDriver: async (driverId: string) => {
      if (!state.selectedRouteId) return;
      await runMutation(() => assignRouteDriver(state.selectedRouteId!, driverId));
    },
    startRoute: async () => {
      if (!state.selectedRouteId) return;
      await runMutation(() => beginRoute(state.selectedRouteId!));
    },
  };
}
