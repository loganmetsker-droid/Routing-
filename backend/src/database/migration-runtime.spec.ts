import { chooseMigrationBaseline, detectAppliedMigrationsFromSchema } from '../../migration-runtime.js';

describe('migration runtime schema baseline', () => {
  it('detects the applied dispatch SaaS migration chain from an existing schema', () => {
    const state = {
      migrationCount: 0,
      tables: {
        drivers: true,
        vehicles: true,
        routes: true,
        reroute_requests: true,
        dispatch_events: true,
        route_versions: true,
        organizations: true,
        app_users: true,
        organization_memberships: true,
        depots: true,
        job_stops: true,
        route_plans: true,
        route_plan_groups: true,
        route_plan_stops: true,
        route_run_stops: true,
        route_assignments: true,
        stop_events: true,
        exceptions: true,
        proof_artifacts: true,
        audit_logs: true,
        customers: true,
        jobs: true,
      },
      columns: {
        drivers: ['roles', 'organization_id'],
        vehicles: ['organization_id'],
        jobs: ['organization_id'],
        customers: ['organization_id'],
        routes: ['polyline', 'color', 'eta', 'workflow_status', 'organization_id'],
        route_versions: ['organization_id'],
        dispatch_events: ['reason_code', 'action', 'actor', 'pack_id', 'aggregate_type', 'aggregate_id', 'event_type', 'actor_user_id', 'organization_id'],
        reroute_requests: ['organization_id'],
      },
    };

    expect(detectAppliedMigrationsFromSchema(state).map((entry: any) => entry.name)).toEqual([
      'InitialSchema1700000000000',
      'AddRouteVisualizationFields1735000000000',
      'AddDriverRoles1735100000000',
      'AddDispatchWorkflowAndEvents1741000000000',
      'AddDispatchEventStructuredIndexes1741800000000',
      'AddRouteVersionsAndDispatchEventAuditFields1741900000000',
      'BackfillRouteVersionsForExistingRoutes1741900100000',
      'AddDispatchSaasFoundation1760000000000',
    ]);
  });

  it('does not fake-baseline migrations when migration history already exists', () => {
    const state = {
      migrationCount: 2,
      tables: { drivers: true, vehicles: true, routes: true },
      columns: {},
    };

    expect(chooseMigrationBaseline(state)).toEqual([]);
  });
});
