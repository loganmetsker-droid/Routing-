import type {
  DispatchDriver,
  DispatchJob,
  DispatchRoute,
  DispatchVehicle,
} from '../../../types/dispatch';
import type {
  DispatchTimelineEvent,
  OptimizerHealth,
  RouteVersion,
  RerouteRequest,
} from '../../../services/api.types';

export type DispatchRouteVersion = RouteVersion;

export type DispatchBoardData = {
  jobs: DispatchJob[];
  routes: DispatchRoute[];
  vehicles: DispatchVehicle[];
  drivers: DispatchDriver[];
  optimizerHealth: OptimizerHealth | null;
  timeline: DispatchTimelineEvent[];
};

export type DispatchBoardState = DispatchBoardData & {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  selectedRouteId: string | null;
  selectedRoute: DispatchRoute | null;
  selectedVersions: DispatchRouteVersion[];
  loadingVersions: boolean;
  mutationError: string | null;
  rerouteHistory: RerouteRequest[];
};
