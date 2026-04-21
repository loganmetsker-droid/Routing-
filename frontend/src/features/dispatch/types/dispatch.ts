import type {
  DispatchDriver,
  DispatchJob,
  DispatchRoute,
  DispatchVehicle,
} from '../../../types/dispatch';
import type {
  DispatchTimelineEvent,
  OptimizerHealth,
  RerouteRequest,
} from '../../../services/api';

export type RouteVersionStatus =
  | 'DRAFT'
  | 'REVIEWED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'SUPERSEDED';

export type DispatchRouteVersion = {
  id: string;
  routeId: string;
  versionNumber: number;
  status: RouteVersionStatus;
  snapshot: Record<string, unknown>;
  createdByUserId?: string | null;
  reviewedByUserId?: string | null;
  approvedByUserId?: string | null;
  publishedByUserId?: string | null;
  createdAt: string;
  updatedAt?: string;
  reviewedAt?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
};

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
