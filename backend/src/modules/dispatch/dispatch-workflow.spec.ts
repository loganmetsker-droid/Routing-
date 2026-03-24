import { RouteStatus } from './entities/route.entity';
import {
  deriveWorkflowRouteStatus,
  isRouteTransitionAllowed,
  mapLegacyRouteStatusToWorkflowStatus,
  normalizeIncomingRouteStatus,
  normalizePlanningMetadata,
} from './dispatch-workflow';

describe('dispatch workflow', () => {
  it('normalizes canonical alias statuses to persisted enum values', () => {
    expect(normalizeIncomingRouteStatus('ready_for_dispatch')).toBe(RouteStatus.ASSIGNED);
    expect(normalizeIncomingRouteStatus('dispatched')).toBe(RouteStatus.IN_PROGRESS);
    expect(normalizeIncomingRouteStatus('rerouting')).toBe(RouteStatus.IN_PROGRESS);
    expect(normalizeIncomingRouteStatus('degraded')).toBe(RouteStatus.IN_PROGRESS);
  });

  it('enforces valid transitions', () => {
    expect(isRouteTransitionAllowed(RouteStatus.PLANNED, RouteStatus.ASSIGNED)).toBe(true);
    expect(isRouteTransitionAllowed(RouteStatus.ASSIGNED, 'dispatched')).toBe(true);
    expect(isRouteTransitionAllowed(RouteStatus.COMPLETED, RouteStatus.PLANNED)).toBe(false);
  });

  it('derives workflow status for dispatcher UX', () => {
    expect(deriveWorkflowRouteStatus(RouteStatus.ASSIGNED, 'live')).toBe('ready_for_dispatch');
    expect(deriveWorkflowRouteStatus(RouteStatus.IN_PROGRESS, 'degraded')).toBe('degraded');
    expect(deriveWorkflowRouteStatus(RouteStatus.IN_PROGRESS, 'live', true)).toBe('rerouting');
    expect(deriveWorkflowRouteStatus(RouteStatus.ASSIGNED, 'live', true)).toBe('rerouting');
  });

  it('maps legacy persisted route status to workflow status', () => {
    expect(mapLegacyRouteStatusToWorkflowStatus(RouteStatus.PLANNED)).toBe('planned');
    expect(mapLegacyRouteStatusToWorkflowStatus(RouteStatus.ASSIGNED)).toBe('ready_for_dispatch');
    expect(mapLegacyRouteStatusToWorkflowStatus(RouteStatus.IN_PROGRESS)).toBe('in_progress');
  });

  it('normalizes planning metadata for fallback/degraded outputs', () => {
    expect(
      normalizePlanningMetadata({
        data_quality: 'simulated',
        optimization_status: 'degraded',
        warnings: ['fallback'],
        dropped_jobs: ['job-1'],
        planner_diagnostics: { 'job-1': { reasonCode: 'capacity_issue' } },
        is_fallback: true,
      }),
    ).toEqual({
      dataQuality: 'simulated',
      optimizationStatus: 'degraded',
      warnings: ['fallback'],
      droppedJobIds: ['job-1'],
      plannerDiagnostics: { 'job-1': { reasonCode: 'capacity_issue' } },
      simulated: true,
    });
  });
});
