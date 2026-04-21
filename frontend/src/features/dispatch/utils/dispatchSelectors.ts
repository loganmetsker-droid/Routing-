import type { DispatchJob, DispatchRoute } from '../../../types/dispatch';

export function getUnassignedJobs(jobs: DispatchJob[]): DispatchJob[] {
  return jobs.filter((job) => {
    const status = String(job.status || '').toLowerCase();
    return !job.assignedRouteId && (status === 'pending' || status === 'unscheduled');
  });
}

export function getRouteExceptions(routes: DispatchRoute[]) {
  return routes.filter((route) => {
    const warnings = Array.isArray(route.planningWarnings) ? route.planningWarnings.length : 0;
    const droppedJobs = Array.isArray(route.droppedJobIds) ? route.droppedJobIds.length : 0;
    return Boolean(route.exceptionCategory || route.rerouteState || warnings || droppedJobs);
  });
}

export function groupRoutesByStatus(routes: DispatchRoute[]) {
  const buckets: Record<string, DispatchRoute[]> = {
    planned: [],
    assigned: [],
    in_progress: [],
    completed: [],
    cancelled: [],
  };

  routes.forEach((route) => {
    const status = String(route.status || 'planned').toLowerCase();
    if (!buckets[status]) {
      buckets[status] = [];
    }
    buckets[status].push(route);
  });

  return buckets;
}
