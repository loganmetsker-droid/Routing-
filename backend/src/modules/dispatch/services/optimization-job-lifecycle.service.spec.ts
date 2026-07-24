import { OptimizationJobLifecycleService } from './optimization-job-lifecycle.service';

describe('OptimizationJobLifecycleService tenant isolation', () => {
  it('returns only lifecycle records for the requested organization', () => {
    const service = new OptimizationJobLifecycleService();
    service.create({
      kind: 'single-route',
      organizationId: 'org-a',
      vehicleIds: ['vehicle-a'],
      jobIds: ['job-a'],
    });
    service.create({
      kind: 'single-route',
      organizationId: 'org-b',
      vehicleIds: ['vehicle-b'],
      jobIds: ['job-b'],
    });

    expect(service.list(100, 'org-a')).toEqual([
      expect.objectContaining({
        organizationId: 'org-a',
        vehicleIds: ['vehicle-a'],
        jobIds: ['job-a'],
      }),
    ]);
  });

  it('keeps unscoped records out of an organization response', () => {
    const service = new OptimizationJobLifecycleService();
    service.create({
      kind: 'reroute',
      routeId: 'legacy-route',
    });

    expect(service.list(100, 'org-a')).toEqual([]);
  });
});
