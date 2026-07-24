import { ConfigService } from '@nestjs/config';
import { JobPriority, JobStatus } from '../jobs/entities/job.entity';
import { DispatchWorker } from './dispatch.worker';

function createQueryBuilder(rows: Array<Record<string, unknown>>) {
  const query = {
    where: vi.fn(),
    andWhere: vi.fn(),
    orderBy: vi.fn(),
    addOrderBy: vi.fn(),
    limit: vi.fn(),
    getMany: vi.fn().mockResolvedValue(rows),
  };
  Object.values(query).forEach((method) => {
    if (method !== query.getMany) method.mockReturnValue(query);
  });
  return query;
}

function createWorker({
  jobs = [],
  vehicles = [],
  createRoute = vi.fn(),
  startRoute = vi.fn(),
}: {
  jobs?: Array<Record<string, unknown>>;
  vehicles?: Array<Record<string, unknown>>;
  createRoute?: ReturnType<typeof vi.fn>;
  startRoute?: ReturnType<typeof vi.fn>;
} = {}) {
  const jobsQuery = createQueryBuilder(jobs);
  const jobRepository = {
    createQueryBuilder: vi.fn().mockReturnValue(jobsQuery),
  };
  const vehicleRepository = {
    find: vi.fn().mockImplementation(({ where }) =>
      Promise.resolve(
        vehicles.filter(
          (vehicle) =>
            !where?.organizationId ||
            vehicle.organizationId === where.organizationId,
        ),
      ),
    ),
  };
  const configService = {
    get: vi.fn((_key: string, fallback?: string) => fallback),
  } as unknown as ConfigService;
  const dispatchService = {
    create: createRoute,
    startRoute,
  };
  const dispatchGateway = {
    emitRouteCreated: vi.fn(),
    emitVehicleStatusUpdate: vi.fn(),
  };
  const runtimeStatusService = {
    registerWorker: vi.fn(),
    touchWorkerHeartbeat: vi.fn(),
    markWorkerRunStarted: vi.fn(),
    markWorkerRunCompleted: vi.fn(),
    markWorkerRunFailed: vi.fn(),
  };
  const worker = new DispatchWorker(
    vehicleRepository as never,
    jobRepository as never,
    configService,
    dispatchService as never,
    dispatchGateway as never,
    runtimeStatusService as never,
  );

  return {
    worker,
    jobsQuery,
    vehicleRepository,
    dispatchService,
    dispatchGateway,
    runtimeStatusService,
  };
}

function pendingJob(id: string, organizationId?: string) {
  return {
    id,
    organizationId,
    status: JobStatus.PENDING,
    priority: JobPriority.NORMAL,
  };
}

function availableVehicle(id: string, organizationId?: string) {
  return {
    id,
    organizationId,
    status: 'available',
  };
}

describe('DispatchWorker tenant isolation and runtime status', () => {
  it('dispatches each organization only with its own vehicles and actor scope', async () => {
    const jobs = [
      pendingJob('job-org-a-0001', 'org-a-0001'),
      pendingJob('job-org-b-0001', 'org-b-0001'),
    ];
    const vehicles = [
      availableVehicle('vehicle-a-0001', 'org-a-0001'),
      availableVehicle('vehicle-b-0001', 'org-b-0001'),
    ];
    const createRoute = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'route-a-0001',
        organizationId: 'org-a-0001',
      })
      .mockResolvedValueOnce({
        id: 'route-b-0001',
        organizationId: 'org-b-0001',
      });
    const startRoute = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'route-a-0001',
        organizationId: 'org-a-0001',
      })
      .mockResolvedValueOnce({
        id: 'route-b-0001',
        organizationId: 'org-b-0001',
      });
    const context = createWorker({
      jobs,
      vehicles,
      createRoute,
      startRoute,
    });

    const result = await context.worker.handleAutoDispatch();

    expect(result).toMatchObject({ success: true, routesCreated: 2 });
    expect(createRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleId: 'vehicle-a-0001',
        jobIds: ['job-org-a-0001'],
      }),
      expect.objectContaining({ organizationId: 'org-a-0001' }),
    );
    expect(createRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleId: 'vehicle-b-0001',
        jobIds: ['job-org-b-0001'],
      }),
      expect.objectContaining({ organizationId: 'org-b-0001' }),
    );
    expect(startRoute).toHaveBeenCalledWith(
      'route-a-0001',
      expect.objectContaining({ organizationId: 'org-a-0001' }),
    );
    expect(startRoute).toHaveBeenCalledWith(
      'route-b-0001',
      expect.objectContaining({ organizationId: 'org-b-0001' }),
    );
    expect(context.runtimeStatusService.markWorkerRunCompleted).toHaveBeenCalledOnce();
    expect(context.runtimeStatusService.markWorkerRunFailed).not.toHaveBeenCalled();
    expect(context.vehicleRepository.find).toHaveBeenNthCalledWith(1, {
      where: { status: 'available', organizationId: 'org-a-0001' },
      take: 10,
    });
    expect(context.vehicleRepository.find).toHaveBeenNthCalledWith(2, {
      where: { status: 'available', organizationId: 'org-b-0001' },
      take: 10,
    });
  });

  it('marks an empty cycle complete instead of leaving the worker running', async () => {
    const context = createWorker();

    const result = await context.worker.handleAutoDispatch();

    expect(result).toMatchObject({
      success: true,
      routesCreated: 0,
      message: 'No pending jobs to dispatch',
    });
    expect(context.runtimeStatusService.markWorkerRunStarted).toHaveBeenCalledOnce();
    expect(context.runtimeStatusService.markWorkerRunCompleted).toHaveBeenCalledOnce();
    expect(context.vehicleRepository.find).not.toHaveBeenCalled();
  });

  it('fails closed for tenantless pending jobs and exposes the failure in runtime status', async () => {
    const context = createWorker({
      jobs: [pendingJob('orphan-job-0001')],
      vehicles: [availableVehicle('orphan-vehicle-0001')],
    });

    const result = await context.worker.handleAutoDispatch();

    expect(result).toMatchObject({
      success: false,
      error: 'AUTO_DISPATCH_PARTIAL_FAILURE',
      routesCreated: 0,
      failedVehicles: [
        expect.objectContaining({
          organizationId: null,
          errorType: 'ORPHANED_PENDING_JOBS',
        }),
      ],
    });
    expect(context.dispatchService.create).not.toHaveBeenCalled();
    expect(context.runtimeStatusService.markWorkerRunFailed).toHaveBeenCalledOnce();
  });

  it('scopes a manual dispatch query and vehicle lookup to the caller organization', async () => {
    const createRoute = vi.fn().mockResolvedValue({
      id: 'route-a-0001',
      organizationId: 'org-a-0001',
    });
    const startRoute = vi.fn().mockResolvedValue({
      id: 'route-a-0001',
      organizationId: 'org-a-0001',
    });
    const context = createWorker({
      jobs: [pendingJob('job-org-a-0001', 'org-a-0001')],
      vehicles: [availableVehicle('vehicle-a-0001', 'org-a-0001')],
      createRoute,
      startRoute,
    });

    await context.worker.manualDispatch('distance', 'org-a-0001');

    expect(context.jobsQuery.andWhere).toHaveBeenCalledWith(
      'job.organization_id = :organizationId',
      { organizationId: 'org-a-0001' },
    );
    expect(context.vehicleRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'available', organizationId: 'org-a-0001' },
        take: 10,
      }),
    );
    expect(createRoute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ organizationId: 'org-a-0001' }),
    );
  });

  it('rejects a manual dispatch without an organization context', async () => {
    const context = createWorker();

    await expect(context.worker.manualDispatch('distance')).rejects.toThrow(
      'Manual dispatch requires an organization context',
    );

    expect(context.jobsQuery.getMany).not.toHaveBeenCalled();
    expect(context.vehicleRepository.find).not.toHaveBeenCalled();
    expect(context.runtimeStatusService.touchWorkerHeartbeat).not.toHaveBeenCalled();
  });

  it('marks partial route failures unhealthy while allowing other tenants to finish', async () => {
    const createRoute = vi
      .fn()
      .mockRejectedValueOnce(new Error('optimizer unavailable'))
      .mockResolvedValueOnce({
        id: 'route-b-0001',
        organizationId: 'org-b-0001',
      });
    const startRoute = vi.fn().mockResolvedValue({
      id: 'route-b-0001',
      organizationId: 'org-b-0001',
    });
    const context = createWorker({
      jobs: [
        pendingJob('job-org-a-0001', 'org-a-0001'),
        pendingJob('job-org-b-0001', 'org-b-0001'),
      ],
      vehicles: [
        availableVehicle('vehicle-a-0001', 'org-a-0001'),
        availableVehicle('vehicle-b-0001', 'org-b-0001'),
      ],
      createRoute,
      startRoute,
    });

    const result = await context.worker.handleAutoDispatch();

    expect(result).toMatchObject({
      success: false,
      error: 'AUTO_DISPATCH_PARTIAL_FAILURE',
      routesCreated: 1,
      failedVehicles: [
        expect.objectContaining({
          organizationId: 'org-a-0001',
          vehicleId: 'vehicle-a-0001',
          errorMessage: 'optimizer unavailable',
        }),
      ],
    });
    expect(context.runtimeStatusService.markWorkerRunFailed).toHaveBeenCalledOnce();
    expect(context.runtimeStatusService.markWorkerRunCompleted).not.toHaveBeenCalled();
  });
});
