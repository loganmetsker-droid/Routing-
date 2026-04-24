import { Injectable } from '@nestjs/common';
import {
  deriveWorkflowRouteStatus,
  normalizePlanningMetadata,
} from '../dispatch-workflow';
import { Route, RouteWorkflowStatus } from '../entities/route.entity';
import type { PresentedRoute } from '../dispatch.types';

@Injectable()
export class DispatchPresentationService {
  presentRoute(route: Route): PresentedRoute {
    const routeData = (route.routeData || {}) as Record<string, unknown>;
    const planning = normalizePlanningMetadata(routeData);
    const workflowStatus = deriveWorkflowRouteStatus(
      route.status,
      planning.dataQuality,
      Boolean(routeData.rerouting),
    );
    return {
      ...(route as Route),
      dataQuality: planning.dataQuality,
      optimizationStatus: planning.optimizationStatus,
      planningWarnings: planning.warnings,
      droppedJobIds: planning.droppedJobIds,
      plannerDiagnostics: planning.plannerDiagnostics,
      workflowStatus: (route.workflowStatus || workflowStatus) as RouteWorkflowStatus,
      simulated: planning.simulated,
      rerouteState: (routeData.reroute_state as string) || null,
      pendingRerouteRequestId:
        (routeData.pending_reroute_request_id as string) || null,
      exceptionCategory: (routeData.exception_category as string) || null,
    };
  }

  buildRouteSnapshot(route: Route) {
    const routeData = (route.routeData || {}) as Record<string, unknown>;
    const planning = normalizePlanningMetadata(routeData);
    return {
      routeId: route.id,
      status: route.status,
      workflowStatus: route.workflowStatus,
      jobIds: Array.isArray(route.jobIds) ? [...route.jobIds] : [],
      totalDistanceKm: route.totalDistanceKm ?? null,
      totalDurationMinutes: route.totalDurationMinutes ?? null,
      eta: route.eta || null,
      dataQuality: planning.dataQuality,
      optimizationStatus: planning.optimizationStatus,
      droppedJobIds: planning.droppedJobIds,
    };
  }

  buildRouteVersionSnapshot(route: Route): Record<string, unknown> {
    return {
      route: this.buildRouteSnapshot(route),
      driverId: route.driverId || null,
      vehicleId: route.vehicleId,
      polyline: route.polyline || null,
      routeData: route.routeData || {},
      notes: route.notes || null,
      plannedStart: route.plannedStart?.toISOString() || null,
    };
  }
}
