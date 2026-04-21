import { ConfigService } from '@nestjs/config';
import { DispatchService } from './dispatch.service';
import { RouteStatus, RouteWorkflowStatus } from './entities/route.entity';

function createQueryBuilder() {
  return {
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };
}

describe('DispatchService route versioning', () => {
  function createServiceHarness() {
    const route = {
      id: 'route-1',
      vehicleId: 'vehicle-1',
      driverId: 'driver-1',
      jobIds: ['job-1', 'job-2'],
      routeData: {},
      polyline: { type: 'LineString', coordinates: [[-94, 39], [-94.1, 39.1]] },
      notes: 'Original plan',
      plannedStart: new Date('2026-04-10T08:00:00.000Z'),
      status: RouteStatus.PLANNED,
      workflowStatus: RouteWorkflowStatus.PLANNED,
      totalDistanceKm: 42,
      totalDurationMinutes: 88,
      jobCount: 2,
    };

    const routeRepository = {
      findOne: jest.fn().mockResolvedValue(route),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const vehicleRepository = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    const driverRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'driver-1' }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const jobRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      }),
    };
    const routeVersionRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((value) => ({
        id: value.id || 'version-1',
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
        updatedAt: new Date('2026-04-10T00:00:00.000Z'),
        ...value,
      })),
      save: jest.fn().mockImplementation(async (value) => value),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const dispatchEventRepository = {
      create: jest.fn((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
      createQueryBuilder: jest.fn().mockReturnValue(createQueryBuilder()),
      find: jest.fn().mockResolvedValue([]),
    };
    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'ROUTING_SERVICE_URL') return 'http://routing-service.test';
        if (key === 'DISPATCH_EVENT_RETENTION_DAYS') return '30';
        return fallback;
      }),
    } as unknown as ConfigService;

    const service = new DispatchService(
      routeRepository as any,
      vehicleRepository as any,
      driverRepository as any,
      jobRepository as any,
      {} as any,
      dispatchEventRepository as any,
      routeVersionRepository as any,
      { post: jest.fn() } as any,
      configService,
      { emitRouteUpdated: jest.fn() } as any,
      { list: jest.fn(), create: jest.fn(), update: jest.fn() } as any,
    );

    return {
      service,
      route,
      routeRepository,
      vehicleRepository,
      driverRepository,
      jobRepository,
      routeVersionRepository,
      dispatchEventRepository,
    };
  }

  it('backfills a published route version when an existing route has no versions', async () => {
    const harness = createServiceHarness();
    harness.routeVersionRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    harness.routeVersionRepository.find.mockResolvedValueOnce([
      {
        id: 'version-1',
        routeId: 'route-1',
        versionNumber: 1,
        status: 'PUBLISHED',
        snapshot: {},
        publishedAt: new Date('2026-04-10T08:30:00.000Z'),
      },
    ]);

    const versions = await harness.service.listRouteVersions('route-1');

    expect(versions).toHaveLength(1);
    expect(harness.routeVersionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: 'route-1',
        versionNumber: 1,
        status: 'PUBLISHED',
      }),
    );
    expect(harness.routeRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        routeData: expect.objectContaining({
          route_version: expect.objectContaining({
            versionNumber: 1,
            status: 'PUBLISHED',
          }),
        }),
      }),
    );
    expect(harness.dispatchEventRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ROUTE_VERSION_BACKFILLED',
        aggregateType: 'ROUTE_VERSION',
      }),
    );
  });

  it('creates a draft route version snapshot and inserts an audit event', async () => {
    const harness = createServiceHarness();
    harness.routeVersionRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'version-1',
        routeId: 'route-1',
        versionNumber: 1,
        status: 'PUBLISHED',
      });

    const version = await harness.service.createRouteVersionSnapshot('route-1', {
      userId: 'user-1',
      email: 'dispatcher@example.com',
      roles: ['DISPATCHER'],
    });

    expect(version.status).toBe('DRAFT');
    expect(version.versionNumber).toBe(2);
    expect(harness.routeVersionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: 'route-1',
        status: 'DRAFT',
        createdByUserId: 'user-1',
      }),
    );
    expect(harness.dispatchEventRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'ROUTE_VERSION',
        eventType: 'ROUTE_VERSION_CREATED',
        actorUserId: 'user-1',
      }),
    );
  });

  it('publishes an approved version, updates the route, and inserts an audit event', async () => {
    const harness = createServiceHarness();
    const approvedVersion = {
      id: 'version-2',
      routeId: 'route-1',
      versionNumber: 2,
      status: 'APPROVED',
      snapshot: {
        route: {
          jobIds: ['job-2', 'job-1'],
          totalDistanceKm: 39,
          totalDurationMinutes: 81,
        },
        driverId: 'driver-2',
        routeData: { route: [{ job_id: 'job-2' }, { job_id: 'job-1' }] },
        polyline: { type: 'LineString', coordinates: [[-94, 39], [-94.3, 39.3]] },
      },
    };

    harness.routeVersionRepository.findOne.mockResolvedValueOnce(approvedVersion);

    const version = await harness.service.publishRouteVersion('route-1', 'version-2', {
      userId: 'admin-1',
      email: 'admin@example.com',
      roles: ['ADMIN'],
    });

    expect(version.status).toBe('PUBLISHED');
    expect(harness.routeVersionRepository.update).toHaveBeenCalledWith(
      { routeId: 'route-1', status: 'PUBLISHED' },
      { status: 'SUPERSEDED' },
    );
    expect(harness.routeRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        driverId: 'driver-2',
        jobIds: ['job-2', 'job-1'],
        routeData: expect.objectContaining({
          route_version: expect.objectContaining({
            versionId: 'version-2',
            versionNumber: 2,
            status: 'PUBLISHED',
            lastPublishedVersionId: 'version-2',
            lastPublishedVersionNumber: 2,
            publishedAt: expect.any(String),
          }),
        }),
      }),
    );
    expect(harness.dispatchEventRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'ROUTE_VERSION',
        eventType: 'ROUTE_VERSION_PUBLISHED',
        actorUserId: 'admin-1',
      }),
    );
  });

  it('forks a draft version before mutating a published route', async () => {
    const harness = createServiceHarness();
    const publishedVersion = {
      id: 'version-1',
      routeId: 'route-1',
      versionNumber: 1,
      status: 'PUBLISHED',
      snapshot: {},
      publishedAt: new Date('2026-04-10T08:30:00.000Z'),
    };

    harness.routeVersionRepository.findOne
      .mockResolvedValueOnce(publishedVersion)
      .mockResolvedValueOnce(publishedVersion);

    const updatedRoute = await harness.service.assignDriver('route-1', 'driver-9', {
      userId: 'dispatcher-1',
      email: 'dispatcher@example.com',
      roles: ['DISPATCHER'],
    });

    expect(updatedRoute.driverId).toBe('driver-9');
    expect(harness.routeVersionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: 'route-1',
        versionNumber: 2,
        status: 'DRAFT',
        createdByUserId: 'dispatcher-1',
      }),
    );
    expect(harness.routeRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        routeData: expect.objectContaining({
          route_version: expect.objectContaining({
            versionNumber: 2,
            status: 'DRAFT',
            lastPublishedVersionNumber: 1,
          }),
        }),
      }),
    );
    expect(harness.dispatchEventRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ROUTE_DRAFT_FORKED_FROM_PUBLISHED',
        aggregateType: 'ROUTE_VERSION',
        actorUserId: 'dispatcher-1',
      }),
    );
  });
});
