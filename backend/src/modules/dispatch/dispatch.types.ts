import type { DataQuality, OptimizationStatus } from './dto/routing-service.dto';
import type { OptimizerHealth } from './dto/routing-service.dto';
import type { RerouteRequest } from './entities/reroute-request.entity';
import type { Route } from './entities/route.entity';
import type { RouteVersion } from './entities/route-version.entity';
import type { DispatchEvent } from './entities/dispatch-event.entity';
import type { OptimizationJobRecord } from './services/optimization-job-lifecycle.service';
import type { RouteRunStop } from './entities/route-run-stop.entity';
import type { DispatchException } from './entities/dispatch-exception.entity';
import type { StopEvent } from './entities/stop-event.entity';
import type { ProofArtifact } from './entities/proof-artifact.entity';
import type { Vehicle } from '../vehicles/entities/vehicle.entity';
import type { NotificationDelivery } from '../notifications/entities/notification-delivery.entity';

export type DispatchActorContext = {
  userId?: string | null;
  email?: string | null;
  organizationId?: string | null;
  roles?: string[];
};

export type DispatchEventInput = {
  routeId?: string | null;
  source: 'optimizer' | 'reroute' | 'workflow' | 'system';
  level?: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  aggregateType?: 'ROUTE' | 'JOB' | 'VEHICLE' | 'ROUTE_VERSION';
  aggregateId?: string | null;
  eventType?: string;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
  reasonCode?: string | null;
  action?: string | null;
  actor?: string | null;
  packId?: string | null;
};

export type DispatchTimelineFilters = {
  reasonCode?: string;
  action?: string;
  actor?: string;
  source?: 'optimizer' | 'reroute' | 'workflow' | 'system';
  before?: string;
  packId?: string;
};

export type PresentedRoute = Route & {
  dataQuality: DataQuality;
  optimizationStatus: OptimizationStatus;
  planningWarnings: string[];
  droppedJobIds: string[];
  plannerDiagnostics: Record<string, unknown>;
  workflowStatus: string;
  simulated: boolean;
  rerouteState?: string | null;
  pendingRerouteRequestId?: string | null;
  exceptionCategory?: string | null;
};

export type DispatchRouteResponse = {
  route: PresentedRoute;
  optimizerHealth: OptimizerHealth;
};

export type DispatchRoutesResponse = {
  routes: PresentedRoute[];
  optimizerHealth: OptimizerHealth;
};

export type DispatchCreateGlobalResponse = {
  routes: PresentedRoute[];
  optimizationStatus: string;
  dataQuality: string;
  droppedJobIds: string[];
  warnings: string[];
  optimizerHealth: OptimizerHealth;
};

export type DispatchTimelineResponse = {
  events: DispatchEvent[];
};

export type DispatchOptimizationJobsResponse = {
  jobs: OptimizationJobRecord[];
};

export type DispatchRerouteResponse = {
  rerouteRequest: RerouteRequest;
  route: PresentedRoute;
  optimizerHealth: OptimizerHealth;
};

export type DispatchRerouteHistoryResponse = {
  rerouteRequests: RerouteRequest[];
};

export type DispatchVersionsResponse = {
  versions: RouteVersion[];
};

export type DispatchVersionResponse = {
  version: RouteVersion;
};

export type RouteRunsBoardResponse = {
  ok: true;
  routes: Route[];
  routeRunStops: RouteRunStop[];
  exceptions: DispatchException[];
};

export type RouteRunsListResponse = {
  ok: true;
  routeRuns: Route[];
};

export type RouteRunsDetailResponse = {
  ok: true;
  routeRun: Route;
  stops: RouteRunStop[];
  exceptions: DispatchException[];
  stopEvents: StopEvent[];
  proofArtifacts: ProofArtifact[];
  notificationDeliveries: NotificationDelivery[];
};

export type RouteRunsExceptionsResponse = {
  ok: true;
  exceptions: DispatchException[];
};

export type RouteRunStopTimelineResponse = {
  ok: true;
  stop: RouteRunStop;
  events: StopEvent[];
};

export type RouteRunStopProofsResponse = {
  ok: true;
  stop: RouteRunStop;
  proofs: ProofArtifact[];
};

export type RouteRunShareLinkResponse = {
  ok: true;
  token: string;
  url: string;
  expiresAt: string;
};

export type DriverManifestResponse = {
  ok: true;
  generatedAt: string;
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    currentVehicleId?: string | null;
  };
  routes: Array<{
    routeRun: Route;
    stops: RouteRunStop[];
    vehicle?: Pick<Vehicle, 'id' | 'make' | 'model' | 'licensePlate' | 'status'> | null;
    latestTelemetry?: {
      latitude: number;
      longitude: number;
      speed?: number | null;
      heading?: number | null;
      timestamp: string;
    } | null;
    progress: {
      totalStops: number;
      completedStops: number;
      remainingStops: number;
      nextStopId?: string | null;
    };
  }>;
};

export type PublicTrackingResponse = {
  ok: true;
  organization: {
    id: string;
    name: string;
    slug: string;
    branding: {
      brandName?: string;
      primaryColor?: string;
      accentColor?: string;
      supportEmail?: string;
      supportPhone?: string;
      trackingHeadline?: string;
      trackingSubtitle?: string;
    };
  };
  routeRun: Route;
  stops: RouteRunStop[];
  vehicle?: Pick<Vehicle, 'id' | 'make' | 'model' | 'licensePlate' | 'status'> | null;
  latestTelemetry?: {
    latitude: number;
    longitude: number;
    speed?: number | null;
    heading?: number | null;
    timestamp: string;
  } | null;
  expiresAt: string;
};
