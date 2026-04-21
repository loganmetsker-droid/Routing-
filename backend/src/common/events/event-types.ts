export const DomainEvents = {
  route: {
    created: 'route.created',
    updated: 'route.updated',
    deleted: 'route.deleted',
    optimizationRequested: 'route.optimization_requested',
    optimizationCompleted: 'route.optimization_completed',
    optimizationFailed: 'route.optimization_failed',
    assigned: 'route.assigned',
    unassigned: 'route.unassigned',
  },
  stop: {
    added: 'stop.added',
    updated: 'stop.updated',
    removed: 'stop.removed',
    resequenced: 'stop.resequenced',
    skipped: 'stop.skipped',
    completed: 'stop.completed',
  },
  dispatch: {
    assignmentCreated: 'dispatch.assignment_created',
    assignmentChanged: 'dispatch.assignment_changed',
    assignmentRemoved: 'dispatch.assignment_removed',
    runStarted: 'dispatch.run_started',
    runCompleted: 'dispatch.run_completed',
    runFailed: 'dispatch.run_failed',
  },
  driver: {
    assigned: 'driver.assigned',
    unassigned: 'driver.unassigned',
  },
  truck: {
    assigned: 'truck.assigned',
    unassigned: 'truck.unassigned',
  },
  exception: {
    created: 'exception.created',
    acknowledged: 'exception.acknowledged',
    resolved: 'exception.resolved',
    dismissed: 'exception.dismissed',
  },
  system: {
    manualOverrideApplied: 'manual_override.applied',
    etaUpdated: 'eta.updated',
    auditLogged: 'audit.logged',
  },
} as const;
