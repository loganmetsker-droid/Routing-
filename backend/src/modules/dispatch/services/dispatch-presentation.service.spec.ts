import { describe, expect, it } from 'vitest';
import { RouteStatus, RouteWorkflowStatus } from '../entities/route.entity';
import { DispatchPresentationService } from './dispatch-presentation.service';

describe('DispatchPresentationService', () => {
  it('derives planning metadata and workflow-facing fields from route data', () => {
    const service = new DispatchPresentationService();
    const route = {
      id: 'route-1',
      vehicleId: 'vehicle-1',
      jobIds: ['job-1'],
      status: RouteStatus.PLANNED,
      workflowStatus: RouteWorkflowStatus.PLANNED,
      routeData: {
        data_quality: 'simulated',
        optimization_status: 'degraded',
        warnings: ['Fallback route used'],
        dropped_jobs: ['job-9'],
        reroute_state: 'defer_job',
        pending_reroute_request_id: 'reroute-1',
        exception_category: 'capacity',
      },
    } as any;

    const presented = service.presentRoute(route);

    expect(presented.dataQuality).toBe('simulated');
    expect(presented.optimizationStatus).toBe('degraded');
    expect(presented.planningWarnings).toEqual(['Fallback route used']);
    expect(presented.droppedJobIds).toEqual(['job-9']);
    expect(presented.rerouteState).toBe('defer_job');
    expect(presented.pendingRerouteRequestId).toBe('reroute-1');
    expect(presented.exceptionCategory).toBe('capacity');
  });
});
