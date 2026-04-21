const ORDERED_MIGRATIONS = [
  { timestamp: 1700000000000, name: 'InitialSchema1700000000000' },
  { timestamp: 1735000000000, name: 'AddRouteVisualizationFields1735000000000' },
  { timestamp: 1735100000000, name: 'AddDriverRoles1735100000000' },
  { timestamp: 1741000000000, name: 'AddDispatchWorkflowAndEvents1741000000000' },
  { timestamp: 1741800000000, name: 'AddDispatchEventStructuredIndexes1741800000000' },
  { timestamp: 1741900000000, name: 'AddRouteVersionsAndDispatchEventAuditFields1741900000000' },
  { timestamp: 1741900100000, name: 'BackfillRouteVersionsForExistingRoutes1741900100000' },
  { timestamp: 1760000000000, name: 'AddDispatchSaasFoundation1760000000000' },
];

function hasTable(state, table) {
  return Boolean(state.tables && state.tables[table]);
}

function hasColumns(state, table, columns) {
  const tableColumns = new Set(state.columns?.[table] || []);
  return columns.every((column) => tableColumns.has(column));
}

function detectAppliedMigrationsFromSchema(state) {
  const applied = [];

  if (['drivers', 'vehicles', 'routes'].every((table) => hasTable(state, table))) {
    applied.push('InitialSchema1700000000000');
  }

  if (hasColumns(state, 'routes', ['polyline', 'color', 'eta'])) {
    applied.push('AddRouteVisualizationFields1735000000000');
  }

  if (hasColumns(state, 'drivers', ['roles'])) {
    applied.push('AddDriverRoles1735100000000');
  }

  if (
    hasColumns(state, 'routes', ['workflow_status']) &&
    hasTable(state, 'reroute_requests') &&
    hasTable(state, 'dispatch_events')
  ) {
    applied.push('AddDispatchWorkflowAndEvents1741000000000');
  }

  if (hasColumns(state, 'dispatch_events', ['reason_code', 'action', 'actor', 'pack_id'])) {
    applied.push('AddDispatchEventStructuredIndexes1741800000000');
  }

  if (
    hasTable(state, 'route_versions') &&
    hasColumns(state, 'dispatch_events', ['aggregate_type', 'aggregate_id', 'event_type', 'actor_user_id'])
  ) {
    applied.push('AddRouteVersionsAndDispatchEventAuditFields1741900000000');
  }

  if (hasTable(state, 'route_versions')) {
    applied.push('BackfillRouteVersionsForExistingRoutes1741900100000');
  }

  if (
    [
      'organizations',
      'app_users',
      'organization_memberships',
      'depots',
      'job_stops',
      'route_plans',
      'route_plan_groups',
      'route_plan_stops',
      'route_run_stops',
      'route_assignments',
      'stop_events',
      'exceptions',
      'proof_artifacts',
      'audit_logs',
    ].every((table) => hasTable(state, table)) &&
    ['customers', 'drivers', 'vehicles', 'jobs', 'routes', 'route_versions', 'dispatch_events', 'reroute_requests'].every((table) =>
      hasColumns(state, table, ['organization_id']),
    )
  ) {
    applied.push('AddDispatchSaasFoundation1760000000000');
  }

  return ORDERED_MIGRATIONS.filter((migration) => applied.includes(migration.name));
}

function chooseMigrationBaseline(state) {
  if ((state.migrationCount || 0) > 0) {
    return [];
  }
  return detectAppliedMigrationsFromSchema(state);
}

module.exports = {
  ORDERED_MIGRATIONS,
  chooseMigrationBaseline,
  detectAppliedMigrationsFromSchema,
};
