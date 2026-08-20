import { PlanningService } from './planning.service';
import { BadRequestException } from '@nestjs/common';

describe('PlanningService', () => {
  function createRepo(initial: any[] = [], options: { enforceRoutePlanStopSequence?: boolean } = {}) {
    let items = [...initial];
    const assertUniqueRoutePlanStopSequences = () => {
      if (!options.enforceRoutePlanStopSequence) return;
      const seen = new Set<string>();
      for (const item of items) {
        if (!item.routePlanId || !item.routePlanGroupId || item.stopSequence === undefined) continue;
        const key = `${item.routePlanId}:${item.routePlanGroupId}:${item.stopSequence}`;
        if (seen.has(key)) {
          throw new Error(`duplicate route plan stop sequence: ${key}`);
        }
        seen.add(key);
      }
    };
    return {
      items,
      create: (value: any) => ({ ...value, id: value.id || `id-${Math.random().toString(36).slice(2, 8)}`, createdAt: value.createdAt || new Date(), updatedAt: new Date() }),
      save: jest.fn(async (value: any) => {
        if (Array.isArray(value)) {
          value.forEach((entry) => {
            const index = items.findIndex((candidate) => candidate.id === entry.id);
            if (index >= 0) items[index] = { ...items[index], ...entry };
            else items.push(entry);
            assertUniqueRoutePlanStopSequences();
          });
          return value;
        }
        const index = items.findIndex((candidate) => candidate.id === value.id);
        if (index >= 0) items[index] = { ...items[index], ...value };
        else items.push(value);
        assertUniqueRoutePlanStopSequences();
        return value;
      }),
      findOne: jest.fn(async ({ where }: any) => items.find((item) => Object.entries(where).every(([key, val]) => item[key] === val)) || null),
      find: jest.fn(async ({ where, order }: any = {}) => {
        let out = [...items];
        if (where) {
          out = out.filter((item) => Object.entries(where).every(([key, val]: [string, any]) => {
            if (val && typeof val === 'object' && '_value' in val) {
              return val._value.includes(item[key]);
            }
            return item[key] === val;
          }));
        }
        if (order) {
          const [key, dir] = Object.entries(order)[0] as [string, any];
          out.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (dir === 'DESC' ? -1 : 1));
        }
        return out;
      }),
      delete: jest.fn(async (where: any) => {
        items = items.filter((item) => !Object.entries(where).every(([key, val]) => item[key] === val));
      }),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        whereInIds: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
    } as any;
  }

  const audit = { record: jest.fn() } as any;
  const httpService = { post: jest.fn(), get: jest.fn() } as any;
  const configService = { get: jest.fn(() => undefined) } as any;

  function createPlanningService(
    routePlans: any,
    routePlanGroups: any,
    routePlanStops: any,
    jobs: any,
    jobStops: any,
    vehicles: any,
    drivers: any,
    depots: any,
    routes: any,
    routeRunStops: any,
    routeAssignments: any,
  ) {
    const repositoriesByEntityName: Record<string, any> = {
      RoutePlan: routePlans,
      RoutePlanGroup: routePlanGroups,
      RoutePlanStop: routePlanStops,
      Job: jobs,
      JobStop: jobStops,
      Vehicle: vehicles,
      Driver: drivers,
    };
    const dataSource = {
      transaction: jest.fn(async (callback: (manager: any) => unknown) =>
        callback({
          getRepository: (entity: { name: string }) =>
            repositoriesByEntityName[entity.name],
        }),
      ),
    } as any;
    return new PlanningService(
      routePlans,
      routePlanGroups,
      routePlanStops,
      jobs,
      jobStops,
      vehicles,
      drivers,
      depots,
      routes,
      routeRunStops,
      routeAssignments,
      dataSource,
      httpService,
      configService,
      audit,
    );
  }

  it('generates a deterministic draft plan with grouped stops', async () => {
    const routePlans = createRepo();
    const routePlanGroups = createRepo();
    const routePlanStops = createRepo();
    const jobs = createRepo([
      { id: 'job-1', organizationId: 'org-1', customerName: 'A', deliveryAddress: 'A St', deliveryLocation: { lat: 39.101, lng: -94.579 }, pickupAddress: '', status: 'pending', priority: 'urgent', createdAt: new Date('2026-04-10T08:00:00Z'), timeWindowStart: new Date('2026-04-10T09:00:00Z'), timeWindowEnd: new Date('2026-04-10T10:00:00Z'), weight: 10, volume: 1 },
      { id: 'job-2', organizationId: 'org-1', customerName: 'B', deliveryAddress: 'B St', deliveryLocation: { lat: 39.111, lng: -94.589 }, pickupAddress: '', status: 'pending', priority: 'normal', createdAt: new Date('2026-04-10T08:05:00Z'), timeWindowStart: new Date('2026-04-10T10:00:00Z'), timeWindowEnd: new Date('2026-04-10T11:00:00Z'), weight: 5, volume: 1 },
    ]);
    const jobStops = createRepo();
    const vehicles = createRepo([{
      id: 'veh-1',
      organizationId: 'org-1',
      status: 'available',
      licensePlate: 'TRK-1',
      capacityWeightKg: 100,
      capacityVolumeM3: 20,
      metadata: {},
      routingProfile: {
        operatingRules: [{
          id: 'secure-load',
          label: 'Secure load',
          instruction: 'Confirm cargo straps before departure.',
          severity: 'hard',
          active: true,
        }],
      },
    }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1' }]);
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ', location: { lat: 39.0997, lng: -94.5786 } }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments);
    const result = await service.generateDraft({ serviceDate: '2026-04-10', vehicleIds: ['veh-1'], objective: 'distance' }, { userId: 'user-1', organizationId: 'org-1' });

    expect(result.routePlan.status).toBe('READY');
    expect(result.groups).toHaveLength(1);
    expect(result.stops.length).toBeGreaterThan(0);
    expect(result.groups[0].vehicleId).toBe('veh-1');
    expect(result.groups[0].warnings).toContain(
      'Vehicle rule: Secure load: Confirm cargo straps before departure.',
    );
  });

  it('builds driver familiarity only from tenant-scoped completed route history', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-06-03', status: 'READY', objective: 'balanced', warnings: [], metrics: {} }]);
    const routePlanGroups = createRepo([{ id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'North Loop' }]);
    const routePlanStops = createRepo([{ id: 'plan-stop-1', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-current', jobStopId: 'job-stop-current', stopSequence: 1 }]);
    const jobs = createRepo();
    const jobStops = createRepo([
      { id: 'job-stop-current', organizationId: 'org-1', jobId: 'job-current', location: { lat: 41.881, lng: -87.631 } },
      ...Array.from({ length: 5 }, (_, index) => ({ id: `history-stop-${index}`, organizationId: 'org-1', jobId: `history-job-${index}`, location: { lat: 41.881 + index * 0.0001, lng: -87.631 } })),
      { id: 'foreign-stop', organizationId: 'org-2', jobId: 'foreign-job', location: { lat: 41.881, lng: -87.631 } },
    ]);
    const vehicles = createRepo();
    const drivers = createRepo([
      { id: 'driver-1', organizationId: 'org-1', employmentStatus: 'active', firstName: 'Maya', lastName: 'Chen' },
      { id: 'driver-foreign', organizationId: 'org-2', employmentStatus: 'active', firstName: 'Other', lastName: 'Tenant' },
    ]);
    const depots = createRepo();
    const routes = createRepo([
      { id: 'history-route-1', organizationId: 'org-1', driverId: 'driver-1', status: 'completed', completedAt: new Date('2026-05-20T18:00:00Z') },
      { id: 'history-route-2', organizationId: 'org-1', driverId: 'driver-1', status: 'completed', completedAt: new Date('2026-05-27T18:00:00Z') },
      { id: 'foreign-route', organizationId: 'org-2', driverId: 'driver-foreign', status: 'completed', completedAt: new Date('2026-06-01T18:00:00Z') },
    ]);
    const routeRunStops = createRepo([
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `run-stop-${index}`,
        organizationId: 'org-1',
        routeId: index % 2 === 0 ? 'history-route-1' : 'history-route-2',
        jobStopId: `history-stop-${index}`,
        status: 'SERVICED',
      })),
      { id: 'foreign-run-stop', organizationId: 'org-2', routeId: 'foreign-route', jobStopId: 'foreign-stop', status: 'SERVICED' },
    ]);
    const routeAssignments = createRepo();
    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments);

    const result = await service.getDriverFamiliarity('plan-1', { userId: 'user-1', organizationId: 'org-1' });

    expect(result.recommendations[0]).toMatchObject({
      status: 'supported',
      recommendedDriverId: 'driver-1',
    });
    expect(result.recommendations[0].candidates.map((candidate) => candidate.driverId)).toEqual(['driver-1']);
    expect(routes.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org-1', status: 'completed' },
    }));
    expect(drivers.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org-1', employmentStatus: 'active' },
    }));
  });

  it('publishes a route plan into live route runs', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'READY', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1' }]);
    const routePlanGroups = createRepo([{ id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1', vehicleId: 'veh-1', driverId: 'drv-1', totalDistanceKm: 12, totalDurationMinutes: 60 }]);
    const routePlanStops = createRepo([{ id: 'rps-1', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'stop-1', stopSequence: 1, isLocked: false, plannedArrival: new Date('2026-04-10T09:00:00Z') }]);
    const jobs = createRepo([{ id: 'job-1', organizationId: 'org-1', customerName: 'A', deliveryAddress: 'A St', status: 'pending', timeWindowStart: new Date('2026-04-10T09:00:00Z'), timeWindowEnd: new Date('2026-04-10T10:00:00Z'), estimatedDuration: 30, routingRequirements: { load: { palletCount: 1, palletLengthIn: 48, palletWidthIn: 40, palletHeightIn: 48, palletWeightLb: 300, stackable: true } } }]);
    const jobStops = createRepo([{ id: 'stop-1', jobId: 'job-1', stopOrder: 1, stopType: 'DROPOFF', address: 'A St', serviceDurationMinutes: 10 }]);
    const vehicles = createRepo([{ id: 'veh-1', organizationId: 'org-1', status: 'available', licensePlate: 'TRK-1' }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1' }]);
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ', location: { lat: 39.0997, lng: -94.5786 } }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments);
    const result = await service.publish('plan-1', { userId: 'user-1', organizationId: 'org-1' });

    expect(result.routePlan.status).toBe('PUBLISHED');
    expect(result.routeRuns).toHaveLength(1);
    expect(routeRunStops.save).toHaveBeenCalled();
    expect(routeAssignments.save).toHaveBeenCalled();
  });

  it('recovers a published plan that has no route runs yet', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'PUBLISHED', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1' }]);
    const routePlanGroups = createRepo([{ id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1', vehicleId: 'veh-1', driverId: 'drv-1', totalDistanceKm: 12, totalDurationMinutes: 60 }]);
    const routePlanStops = createRepo([{ id: 'rps-1', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'stop-1', stopSequence: 1, isLocked: false, plannedArrival: new Date('2026-04-10T09:00:00Z') }]);
    const jobs = createRepo([{ id: 'job-1', organizationId: 'org-1', customerName: 'A', deliveryAddress: 'A St', status: 'pending', timeWindowStart: new Date('2026-04-10T09:00:00Z'), timeWindowEnd: new Date('2026-04-10T10:00:00Z'), estimatedDuration: 30, routingRequirements: { load: { palletCount: 1, palletLengthIn: 48, palletWidthIn: 40, palletHeightIn: 48, palletWeightLb: 300, stackable: true } } }]);
    const jobStops = createRepo([{ id: 'stop-1', jobId: 'job-1', stopOrder: 1, stopType: 'DROPOFF', address: 'A St', serviceDurationMinutes: 10 }]);
    const vehicles = createRepo([{ id: 'veh-1', organizationId: 'org-1', status: 'available', licensePlate: 'TRK-1' }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1' }]);
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ', location: { lat: 39.0997, lng: -94.5786 } }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments);
    const result = await service.publish('plan-1', { userId: 'user-1', organizationId: 'org-1' });

    expect(result.routeRuns).toHaveLength(1);
    expect(routeRunStops.save).toHaveBeenCalled();
    expect(routeAssignments.save).toHaveBeenCalled();
  });

  it('blocks publish readiness when stops reference missing route lanes', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'READY', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1', publishDecisions: [] }]);
    const routePlanGroups = createRepo([]);
    const routePlanStops = createRepo([{ id: 'rps-1', routePlanId: 'plan-1', routePlanGroupId: 'missing-group', jobId: 'job-1', jobStopId: 'stop-1', stopSequence: 1, isLocked: false, plannedArrival: new Date('2026-04-10T09:00:00Z') }]);
    const jobs = createRepo([{ id: 'job-1', organizationId: 'org-1', customerName: 'A', deliveryAddress: 'A St', status: 'pending', timeWindowStart: new Date('2026-04-10T09:00:00Z'), timeWindowEnd: new Date('2026-04-10T10:00:00Z'), estimatedDuration: 30, routingRequirements: { load: { palletCount: 1, palletLengthIn: 48, palletWidthIn: 40, palletHeightIn: 48, palletWeightLb: 300, stackable: true } } }]);
    const jobStops = createRepo([{ id: 'stop-1', jobId: 'job-1', stopOrder: 1, stopType: 'DROPOFF', address: 'A St', serviceDurationMinutes: 10 }]);
    const vehicles = createRepo([{ id: 'veh-1', organizationId: 'org-1', status: 'available', licensePlate: 'TRK-1' }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1' }]);
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ', location: { lat: 39.0997, lng: -94.5786 } }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments);
    const readiness = await service.getPublishReadiness('plan-1', { userId: 'user-1', organizationId: 'org-1' });

    expect(readiness.ready).toBe(false);
    expect(readiness.blockingBlockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ORPHANED_PLAN_STOPS', canAcceptRisk: false }),
      ]),
    );
  });

  it('blocks publish when a planned route is missing a driver', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'READY', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1', publishDecisions: [] }]);
    const routePlanGroups = createRepo([{ id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1', vehicleId: 'veh-1', driverId: null, totalDistanceKm: 12, totalDurationMinutes: 60 }]);
    const routePlanStops = createRepo([{ id: 'rps-1', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'stop-1', stopSequence: 1, isLocked: false, plannedArrival: new Date('2026-04-10T09:00:00Z') }]);
    const jobs = createRepo([{ id: 'job-1', organizationId: 'org-1', customerName: 'A', deliveryAddress: 'A St', status: 'pending', timeWindowStart: new Date('2026-04-10T09:00:00Z'), timeWindowEnd: new Date('2026-04-10T10:00:00Z'), estimatedDuration: 30, routingRequirements: { load: { palletCount: 1, palletLengthIn: 48, palletWidthIn: 40, palletHeightIn: 48, palletWeightLb: 300, stackable: true } } }]);
    const jobStops = createRepo([{ id: 'stop-1', jobId: 'job-1', stopOrder: 1, stopType: 'DROPOFF', address: 'A St', serviceDurationMinutes: 10 }]);
    const vehicles = createRepo([{ id: 'veh-1', organizationId: 'org-1', status: 'available', licensePlate: 'TRK-1' }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1' }]);
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ', location: { lat: 39.0997, lng: -94.5786 } }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments);

    await expect(service.publish('plan-1', { userId: 'user-1', organizationId: 'org-1' })).rejects.toMatchObject({
      response: expect.objectContaining({
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: 'MISSING_DRIVER', groupId: 'group-1' }),
        ]),
      }),
    });
  });

  it('blocks publish when a planned job is missing routing-critical load data', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'READY', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1', publishDecisions: [] }]);
    const routePlanGroups = createRepo([{ id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1', vehicleId: 'veh-1', driverId: 'drv-1', totalDistanceKm: 12, totalDurationMinutes: 60 }]);
    const routePlanStops = createRepo([{ id: 'rps-1', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'stop-1', stopSequence: 1, isLocked: false, plannedArrival: new Date('2026-04-10T09:00:00Z') }]);
    const jobs = createRepo([{ id: 'job-1', organizationId: 'org-1', customerName: 'A', deliveryAddress: 'A St', status: 'pending', timeWindowStart: new Date('2026-04-10T09:00:00Z'), timeWindowEnd: new Date('2026-04-10T10:00:00Z'), estimatedDuration: 30, routingRequirements: { load: { palletCount: 2, palletWeightLb: 500 } } }]);
    const jobStops = createRepo([{ id: 'stop-1', jobId: 'job-1', stopOrder: 1, stopType: 'DROPOFF', address: 'A St', serviceDurationMinutes: 10 }]);
    const vehicles = createRepo([{ id: 'veh-1', organizationId: 'org-1', status: 'available', licensePlate: 'TRK-1' }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1' }]);
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ', location: { lat: 39.0997, lng: -94.5786 } }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments);

    await expect(service.publish('plan-1', { userId: 'user-1', organizationId: 'org-1' })).rejects.toMatchObject({
      response: expect.objectContaining({
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: 'JOB_MISSING_DATA', jobId: 'job-1' }),
        ]),
      }),
    });
  });

  it('allows publish after an operator accepts an overrideable capacity risk with a reason', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'READY', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1', publishDecisions: [] }]);
    const routePlanGroups = createRepo([{ id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1', vehicleId: 'veh-1', driverId: 'drv-1', totalDistanceKm: 12, totalDurationMinutes: 60 }]);
    const routePlanStops = createRepo([{ id: 'rps-1', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'stop-1', stopSequence: 1, isLocked: false, plannedArrival: new Date('2026-04-10T09:00:00Z') }]);
    const jobs = createRepo([{ id: 'job-1', organizationId: 'org-1', customerName: 'A', deliveryAddress: 'A St', status: 'pending', timeWindowStart: new Date('2026-04-10T09:00:00Z'), timeWindowEnd: new Date('2026-04-10T10:00:00Z'), estimatedDuration: 30, routingRequirements: { load: { palletCount: 32, palletLengthIn: 48, palletWidthIn: 40, palletHeightIn: 60, palletWeightLb: 500, stackable: false } } }]);
    const jobStops = createRepo([{ id: 'stop-1', jobId: 'job-1', stopOrder: 1, stopType: 'DROPOFF', address: 'A St', serviceDurationMinutes: 10 }]);
    const vehicles = createRepo([{ id: 'veh-1', organizationId: 'org-1', status: 'available', licensePlate: 'TRK-1' }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1' }]);
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ', location: { lat: 39.0997, lng: -94.5786 } }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments);

    await expect(service.publish('plan-1', { userId: 'user-1', organizationId: 'org-1' })).rejects.toBeInstanceOf(BadRequestException);

    await service.acceptPublishRisk(
      'plan-1',
      {
        blockerCode: 'JOB_CAPACITY_RISK',
        jobId: 'job-1',
        reason: 'Operations confirmed this runs on a dedicated trailer.',
      },
      { userId: 'user-1', organizationId: 'org-1' },
    );
    const result = await service.publish('plan-1', { userId: 'user-1', organizationId: 'org-1' });

    expect(result.routePlan.status).toBe('PUBLISHED');
    expect(result.routeRuns).toHaveLength(1);
  });

  it('requires an audited risk decision for vehicle and load-fit warnings before publish', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'READY', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1', publishDecisions: [] }]);
    const routePlanGroups = createRepo([
      { id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Glass route', vehicleId: 'veh-1', driverId: 'drv-1', totalDistanceKm: 12, totalDurationMinutes: 60, warnings: ['Vehicle rule: Glass securement: Use E-track straps and corner protectors.'] },
      { id: 'group-empty', routePlanId: 'plan-1', groupIndex: 2, label: 'Empty route', vehicleId: 'veh-2', driverId: 'drv-2', totalDistanceKm: 0, totalDurationMinutes: 0, warnings: ['Vehicle rule: Empty groups must not block publish.'] },
    ]);
    const routePlanStops = createRepo([{ id: 'rps-1', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'stop-1', stopSequence: 1, isLocked: false, plannedArrival: new Date('2026-04-10T09:00:00Z') }]);
    const jobs = createRepo([{ id: 'job-1', organizationId: 'org-1', customerName: 'Glass Co', deliveryAddress: 'A St', status: 'pending', timeWindowStart: new Date('2026-04-10T09:00:00Z'), timeWindowEnd: new Date('2026-04-10T10:00:00Z'), estimatedDuration: 30, routingRequirements: { load: { palletCount: 1, palletLengthIn: 48, palletWidthIn: 40, palletHeightIn: 48, palletWeightLb: 300, stackable: false } } }]);
    const jobStops = createRepo([{ id: 'stop-1', jobId: 'job-1', stopOrder: 1, stopType: 'DROPOFF', address: 'A St', serviceDurationMinutes: 10 }]);
    const vehicles = createRepo([{ id: 'veh-1', organizationId: 'org-1', status: 'available', licensePlate: 'TRK-1' }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1' }]);
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ', location: { lat: 39.0997, lng: -94.5786 } }]);
    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, createRepo(), createRepo(), createRepo());

    const beforeDecision = await service.getPublishReadiness('plan-1', { userId: 'user-1', organizationId: 'org-1' });
    expect(beforeDecision.ready).toBe(false);
    expect(beforeDecision.blockingBlockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'ROUTE_GROUP_WARNING',
        groupId: 'group-1',
        warningIndex: 0,
        canAcceptRisk: true,
        message: 'Glass route: Vehicle rule: Glass securement: Use E-track straps and corner protectors.',
      }),
    ]));

    const afterDecision = await service.acceptPublishRisk(
      'plan-1',
      {
        blockerCode: 'ROUTE_GROUP_WARNING',
        groupId: 'group-1',
        warningIndex: 0,
        reason: 'Dispatcher confirmed the required securement is loaded.',
      },
      { userId: 'user-1', organizationId: 'org-1' },
    );

    expect(afterDecision.ready).toBe(true);
    expect(afterDecision.summary.acceptedRiskCount).toBe(1);
  });

  it('preserves locked stops when regenerating an existing draft plan', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'DRAFT', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1' }]);
    const routePlanGroups = createRepo([{ id: 'group-old', routePlanId: 'plan-1', groupIndex: 1, label: 'Old Route', vehicleId: 'veh-1', driverId: 'drv-1' }]);
    const routePlanStops = createRepo([{ id: 'locked-stop', routePlanId: 'plan-1', routePlanGroupId: 'group-old', jobId: 'job-1', jobStopId: 'stop-1', stopSequence: 1, isLocked: true }]);
    const jobs = createRepo([{ id: 'job-1', organizationId: 'org-1', customerName: 'A', deliveryAddress: 'A St', deliveryLocation: { lat: 39.101, lng: -94.579 }, pickupAddress: '', status: 'pending', priority: 'urgent', createdAt: new Date('2026-04-10T08:00:00Z') }]);
    const jobStops = createRepo([{ id: 'stop-1', organizationId: 'org-1', jobId: 'job-1', stopOrder: 1, stopType: 'DROPOFF', address: 'A St', location: { lat: 39.101, lng: -94.579 }, serviceDurationMinutes: 10 }]);
    const vehicles = createRepo([{ id: 'veh-1', organizationId: 'org-1', status: 'available', licensePlate: 'TRK-1', capacityWeightKg: 100, capacityVolumeM3: 20, metadata: {} }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1' }]);
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ', location: { lat: 39.0997, lng: -94.5786 } }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments);
    const result = await service.generateDraft({ serviceDate: '2026-04-10', vehicleIds: ['veh-1'], objective: 'distance' }, { userId: 'user-1', organizationId: 'org-1' });

    expect(result.stops[0].isLocked).toBe(true);
  });

  it('resequences source and target groups when moving a stop', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'READY', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1' }]);
    const routePlanGroups = createRepo([
      { id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1', vehicleId: 'veh-1', totalDurationMinutes: 60, serviceTimeMinutes: 20, totalWeightKg: 2, totalVolumeM3: 2 },
      { id: 'group-2', routePlanId: 'plan-1', groupIndex: 2, label: 'Route 2', vehicleId: 'veh-2', totalDurationMinutes: 30, serviceTimeMinutes: 10, totalWeightKg: 1, totalVolumeM3: 1 },
    ]);
    const routePlanStops = createRepo([
      { id: 'stop-a', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'job-stop-1', stopSequence: 1, isLocked: false, createdAt: new Date('2026-04-10T08:00:00Z') },
      { id: 'stop-b', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-2', jobStopId: 'job-stop-2', stopSequence: 2, isLocked: false, createdAt: new Date('2026-04-10T08:05:00Z') },
      { id: 'stop-c', routePlanId: 'plan-1', routePlanGroupId: 'group-2', jobId: 'job-3', jobStopId: 'job-stop-3', stopSequence: 1, isLocked: false, createdAt: new Date('2026-04-10T08:10:00Z') },
    ], { enforceRoutePlanStopSequence: true });
    const jobs = createRepo([
      { id: 'job-1', organizationId: 'org-1', weight: 1, volume: 1 },
      { id: 'job-2', organizationId: 'org-1', weight: 1, volume: 1 },
      { id: 'job-3', organizationId: 'org-1', weight: 1, volume: 1 },
    ]);
    const jobStops = createRepo([
      { id: 'job-stop-1', jobId: 'job-1', serviceDurationMinutes: 10 },
      { id: 'job-stop-2', jobId: 'job-2', serviceDurationMinutes: 10 },
      { id: 'job-stop-3', jobId: 'job-3', serviceDurationMinutes: 10 },
    ]);
    const vehicles = createRepo([
      { id: 'veh-1', organizationId: 'org-1', capacityWeightKg: 100, capacityVolumeM3: 20, metadata: { maxShiftMinutes: 480 } },
      { id: 'veh-2', organizationId: 'org-1', capacityWeightKg: 100, capacityVolumeM3: 20, metadata: { maxShiftMinutes: 480 } },
    ]);
    const drivers = createRepo();
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ' }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments);
    const result = await service.updateStop('plan-1', 'stop-b', { targetGroupId: 'group-2', targetSequence: 1 }, { userId: 'user-1', organizationId: 'org-1' });

    const group1Stops = result.stops.filter((stop: any) => stop.routePlanGroupId === 'group-1').sort((a: any, b: any) => a.stopSequence - b.stopSequence);
    const group2Stops = result.stops.filter((stop: any) => stop.routePlanGroupId === 'group-2').sort((a: any, b: any) => a.stopSequence - b.stopSequence);

    expect(group1Stops.map((stop: any) => stop.id)).toEqual(['stop-a']);
    expect(group1Stops.map((stop: any) => stop.stopSequence)).toEqual([1]);
    expect(group2Stops.map((stop: any) => stop.id)).toEqual(['stop-b', 'stop-c']);
    expect(group2Stops.map((stop: any) => stop.stopSequence)).toEqual([1, 2]);
  });

  it('inserts an unassigned job into a route group and forces reoptimization', async () => {
    const routePlans = createRepo([{
      id: 'plan-1',
      organizationId: 'org-1',
      serviceDate: '2026-04-10',
      status: 'READY',
      objective: 'distance',
      warnings: [],
      metrics: { assignedJobCount: 2, unassignedJobCount: 1, totalDurationMinutes: 120 },
      depotId: 'dep-1',
    }]);
    const routePlanGroups = createRepo([{
      id: 'group-1',
      routePlanId: 'plan-1',
      groupIndex: 1,
      label: 'Route 1',
      vehicleId: 'veh-1',
      driverId: 'drv-1',
      totalDistanceKm: 12,
      totalDurationMinutes: 120,
      serviceTimeMinutes: 40,
      totalWeightKg: 25,
      totalVolumeM3: 2,
      warnings: [],
    }]);
    const routePlanStops = createRepo([
      { id: 'stop-a', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'job-stop-1', stopSequence: 1, isLocked: false, createdAt: new Date('2026-04-10T08:00:00Z') },
      { id: 'stop-b', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-2', jobStopId: 'job-stop-2', stopSequence: 2, isLocked: false, createdAt: new Date('2026-04-10T08:05:00Z') },
    ], { enforceRoutePlanStopSequence: true });
    const jobs = createRepo([{
      id: 'job-3',
      organizationId: 'org-1',
      customerName: 'Insert Me',
      pickupAddress: '',
      deliveryAddress: 'C St',
      deliveryLocation: { lat: 39.12, lng: -94.59 },
      status: 'pending',
      timeWindowStart: new Date('2026-04-10T11:00:00Z'),
      timeWindowEnd: new Date('2026-04-10T12:00:00Z'),
      estimatedDuration: 20,
      weight: 10,
      volume: 1,
      quantity: 1,
      routingRequirements: {
        load: {
          palletCount: 1,
          palletLengthIn: 48,
          palletWidthIn: 40,
          palletHeightIn: 48,
          palletWeightLb: 300,
          stackable: true,
        },
      },
    }]);
    const jobStops = createRepo([{
      id: 'job-stop-3',
      organizationId: 'org-1',
      jobId: 'job-3',
      stopOrder: 1,
      stopType: 'DROPOFF',
      address: 'C St',
      serviceDurationMinutes: 20,
      timeWindowStart: new Date('2026-04-10T11:00:00Z'),
      timeWindowEnd: new Date('2026-04-10T12:00:00Z'),
    }]);
    const vehicles = createRepo([{
      id: 'veh-1',
      organizationId: 'org-1',
      status: 'available',
      licensePlate: 'TRK-1',
      capacityWeightKg: 100,
      capacityVolumeM3: 20,
      metadata: { maxShiftMinutes: 480 },
    }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1' }]);
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ' }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments);
    const result = await service.insertJob(
      'plan-1',
      'group-1',
      { jobId: 'job-3', targetSequence: 2 },
      { userId: 'user-1', organizationId: 'org-1' },
    );

    const orderedStops = result.stops
      .filter((stop: any) => stop.routePlanGroupId === 'group-1')
      .sort((left: any, right: any) => left.stopSequence - right.stopSequence);
    expect(orderedStops.map((stop: any) => stop.jobId)).toEqual(['job-1', 'job-3', 'job-2']);
    expect(orderedStops.map((stop: any) => stop.stopSequence)).toEqual([1, 2, 3]);
    expect(result.routePlan.status).toBe('DRAFT');
    expect(result.routePlan.metrics).toMatchObject({
      assignedJobCount: 3,
      unassignedJobCount: 0,
      totalDurationMinutes: 152,
    });
    expect(result.groups[0]).toMatchObject({
      totalDurationMinutes: 152,
      serviceTimeMinutes: 60,
      totalWeightKg: 35,
      totalVolumeM3: 3,
    });
    expect(result.routePlan.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'MANUAL_INSERTION_REOPTIMIZE_REQUIRED',
          jobId: 'job-3',
          groupId: 'group-1',
        }),
      ]),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'route-plan.job.inserted' }),
    );
  });

  it('rejects a driver–vehicle assignment that violates a saved route rule', async () => {
    const routePlans = createRepo([{
      id: 'plan-1',
      organizationId: 'org-1',
      serviceDate: '2026-04-10',
      status: 'DRAFT',
      objective: 'distance',
      warnings: [],
      metrics: {},
    }]);
    const routePlanGroups = createRepo([{
      id: 'group-1',
      routePlanId: 'plan-1',
      groupIndex: 1,
      label: 'Route 1',
      vehicleId: 'veh-1',
      driverId: null,
      warnings: [],
    }]);
    const routePlanStops = createRepo([{
      id: 'stop-1',
      routePlanId: 'plan-1',
      routePlanGroupId: 'group-1',
      jobId: 'job-1',
      jobStopId: 'job-stop-1',
      stopSequence: 1,
    }]);
    const jobs = createRepo([{
      id: 'job-1',
      organizationId: 'org-1',
      customerName: 'Restricted customer',
      routingRequirements: {
        driver: { prohibitedDriverIds: ['drv-blocked'] },
      },
    }]);
    const vehicles = createRepo([{
      id: 'veh-1',
      organizationId: 'org-1',
      capacityWeightKg: 5000,
      capacityVolumeM3: 30,
    }]);
    const drivers = createRepo([{
      id: 'drv-blocked',
      organizationId: 'org-1',
      certifications: [],
    }]);
    const service = createPlanningService(
      routePlans,
      routePlanGroups,
      routePlanStops,
      jobs,
      createRepo(),
      vehicles,
      drivers,
      createRepo(),
      createRepo(),
      createRepo(),
      createRepo(),
    );

    await expect(
      service.updateGroup(
        'plan-1',
        'group-1',
        { driverId: 'drv-blocked' },
        { userId: 'user-1', organizationId: 'org-1' },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ROUTE_GROUP_FLEET_CONSTRAINT',
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: 'DRIVER_PROHIBITED' }),
        ]),
      }),
    });
  });

  it('rejects a route insertion that exceeds vehicle capacity', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'READY', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1' }]);
    const routePlanGroups = createRepo([{ id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1', vehicleId: 'veh-1', driverId: 'drv-1', totalDurationMinutes: 60, serviceTimeMinutes: 20, totalWeightKg: 90, totalVolumeM3: 1, warnings: [] }]);
    const routePlanStops = createRepo([], { enforceRoutePlanStopSequence: true });
    const jobs = createRepo([{
      id: 'job-heavy', organizationId: 'org-1', customerName: 'Heavy', pickupAddress: '', deliveryAddress: 'Heavy St', deliveryLocation: { lat: 39.12, lng: -94.59 }, status: 'pending', timeWindowStart: new Date('2026-04-10T11:00:00Z'), timeWindowEnd: new Date('2026-04-10T12:00:00Z'), estimatedDuration: 20, weight: 20, volume: 1, quantity: 1,
      routingRequirements: { load: { palletCount: 1, palletLengthIn: 48, palletWidthIn: 40, palletHeightIn: 48, palletWeightLb: 300, stackable: true } },
    }]);
    const jobStops = createRepo([{ id: 'job-stop-heavy', organizationId: 'org-1', jobId: 'job-heavy', stopOrder: 1, stopType: 'DROPOFF', address: 'Heavy St', serviceDurationMinutes: 20 }]);
    const vehicles = createRepo([{ id: 'veh-1', organizationId: 'org-1', status: 'available', licensePlate: 'TRK-1', capacityWeightKg: 100, capacityVolumeM3: 20, metadata: { maxShiftMinutes: 480 } }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1' }]);
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ' }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments);

    await expect(
      service.insertJob(
        'plan-1',
        'group-1',
        { jobId: 'job-heavy' },
        { userId: 'user-1', organizationId: 'org-1' },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ROUTE_INSERTION_CONSTRAINT',
        constraints: expect.arrayContaining(['weight']),
      }),
    });
    expect(routePlanStops.items).toHaveLength(0);
  });

  it('inserts an access-controlled first stop at the front of the route', async () => {
    const routePlans = createRepo([{
      id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'READY', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1',
    }]);
    const routePlanGroups = createRepo([{
      id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1', vehicleId: 'veh-1', driverId: 'drv-1', totalDurationMinutes: 40, serviceTimeMinutes: 10, totalWeightKg: 100, totalVolumeM3: 2, warnings: [],
    }]);
    const routePlanStops = createRepo([{
      id: 'stop-existing', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-existing', jobStopId: 'job-stop-existing', stopSequence: 1, isLocked: false, createdAt: new Date('2026-04-10T08:00:00Z'),
    }], { enforceRoutePlanStopSequence: true });
    const baseLoad = {
      palletCount: 1, palletLengthIn: 48, palletWidthIn: 40, palletHeightIn: 48, palletWeightLb: 600, stackable: false,
    };
    const jobs = createRepo([
      {
        id: 'job-existing', organizationId: 'org-1', customerName: 'Routine stop', deliveryAddress: 'Routine St', status: 'pending', timeWindowStart: new Date('2026-04-10T10:00:00Z'), timeWindowEnd: new Date('2026-04-10T11:00:00Z'), estimatedDuration: 10, routingRequirements: { load: baseLoad },
      },
      {
        id: 'job-gated-first', organizationId: 'org-1', customerName: 'Gated first stop', deliveryAddress: 'Gate St', status: 'pending', timeWindowStart: new Date('2026-04-10T09:00:00Z'), timeWindowEnd: new Date('2026-04-10T10:00:00Z'), estimatedDuration: 15,
        routingRequirements: {
          load: baseLoad,
          sequence: { position: 'first', strict: true },
          site: { accessCode: '4827', accessCodeRequired: true, gateInstructions: 'Use the keypad.' },
        },
      },
    ]);
    const jobStops = createRepo([
      { id: 'job-stop-existing', organizationId: 'org-1', jobId: 'job-existing', stopOrder: 1, stopType: 'DROPOFF', address: 'Routine St', serviceDurationMinutes: 10 },
      { id: 'job-stop-gated', organizationId: 'org-1', jobId: 'job-gated-first', stopOrder: 1, stopType: 'DROPOFF', address: 'Gate St', serviceDurationMinutes: 15 },
    ]);
    const vehicles = createRepo([{
      id: 'veh-1', organizationId: 'org-1', status: 'available', licensePlate: 'TRK-1', capacityWeightKg: 5000, capacityVolumeM3: 30, routingProfile: { cargo: { maxPalletPositions: 10 } }, metadata: { maxShiftMinutes: 480 },
    }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1', certifications: [] }]);
    const service = createPlanningService(
      routePlans,
      routePlanGroups,
      routePlanStops,
      jobs,
      jobStops,
      vehicles,
      drivers,
      createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ' }]),
      createRepo(),
      createRepo(),
      createRepo(),
    );

    const result = await service.insertJob(
      'plan-1',
      'group-1',
      { jobId: 'job-gated-first', targetSequence: 2 },
      { userId: 'user-1', organizationId: 'org-1' },
    );

    expect(
      result.stops
        .slice()
        .sort((left: any, right: any) => left.stopSequence - right.stopSequence)
        .map((stop: any) => stop.jobId),
    ).toEqual([
      'job-gated-first',
      'job-existing',
    ]);
    expect(result.routePlan.status).toBe('DRAFT');
  });

  it('batch moves selected jobs as complete bundles and updates affected route workloads', async () => {
    const routePlans = createRepo([{
      id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'READY', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1',
    }]);
    const routePlanGroups = createRepo([
      { id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1', vehicleId: 'veh-1', driverId: 'drv-1', totalDurationMinutes: 100, serviceTimeMinutes: 20, totalWeightKg: 30, totalVolumeM3: 3, warnings: [] },
      { id: 'group-2', routePlanId: 'plan-1', groupIndex: 2, label: 'Route 2', vehicleId: 'veh-2', driverId: 'drv-2', totalDurationMinutes: 60, serviceTimeMinutes: 10, totalWeightKg: 10, totalVolumeM3: 1, warnings: [] },
    ]);
    const routePlanStops = createRepo([
      { id: 'stop-job-1-a', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'job-stop-1-a', stopSequence: 1, isLocked: false, plannedArrival: new Date('2026-04-10T09:00:00Z'), createdAt: new Date('2026-04-10T08:00:00Z') },
      { id: 'stop-job-1-b', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'job-stop-1-b', stopSequence: 2, isLocked: false, plannedArrival: new Date('2026-04-10T09:20:00Z'), createdAt: new Date('2026-04-10T08:01:00Z') },
      { id: 'stop-job-2', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-2', jobStopId: 'job-stop-2', stopSequence: 3, isLocked: false, createdAt: new Date('2026-04-10T08:02:00Z') },
      { id: 'stop-job-3', routePlanId: 'plan-1', routePlanGroupId: 'group-2', jobId: 'job-3', jobStopId: 'job-stop-3', stopSequence: 1, isLocked: false, createdAt: new Date('2026-04-10T08:03:00Z') },
    ], { enforceRoutePlanStopSequence: true });
    const jobs = createRepo([
      { id: 'job-1', organizationId: 'org-1', weight: 20, volume: 2 },
      { id: 'job-2', organizationId: 'org-1', weight: 10, volume: 1 },
      { id: 'job-3', organizationId: 'org-1', weight: 10, volume: 1 },
    ]);
    const jobStops = createRepo([
      { id: 'job-stop-1-a', jobId: 'job-1', serviceDurationMinutes: 10 },
      { id: 'job-stop-1-b', jobId: 'job-1', serviceDurationMinutes: 5 },
      { id: 'job-stop-2', jobId: 'job-2', serviceDurationMinutes: 5 },
      { id: 'job-stop-3', jobId: 'job-3', serviceDurationMinutes: 10 },
    ]);
    const vehicles = createRepo([
      { id: 'veh-1', organizationId: 'org-1', capacityWeightKg: 100, capacityVolumeM3: 20, metadata: { maxShiftMinutes: 480 } },
      { id: 'veh-2', organizationId: 'org-1', capacityWeightKg: 100, capacityVolumeM3: 20, metadata: { maxShiftMinutes: 480 } },
    ]);
    const service = createPlanningService(
      routePlans,
      routePlanGroups,
      routePlanStops,
      jobs,
      jobStops,
      vehicles,
      createRepo(),
      createRepo(),
      createRepo(),
      createRepo(),
      createRepo(),
    );

    const result = await service.batchMoveStops(
      'plan-1',
      { stopIds: ['stop-job-1-a'], targetGroupId: 'group-2', targetSequence: 2 },
      { userId: 'user-1', organizationId: 'org-1' },
    );

    const group1Stops = result.stops
      .filter((stop: any) => stop.routePlanGroupId === 'group-1')
      .sort((left: any, right: any) => left.stopSequence - right.stopSequence);
    const group2Stops = result.stops
      .filter((stop: any) => stop.routePlanGroupId === 'group-2')
      .sort((left: any, right: any) => left.stopSequence - right.stopSequence);
    expect(group1Stops.map((stop: any) => stop.id)).toEqual(['stop-job-2']);
    expect(group2Stops.map((stop: any) => stop.id)).toEqual([
      'stop-job-3',
      'stop-job-1-a',
      'stop-job-1-b',
    ]);
    expect(group2Stops.slice(1).every((stop: any) => stop.plannedArrival === null)).toBe(true);
    expect(result.groups.find((group: any) => group.id === 'group-1')).toMatchObject({
      totalDurationMinutes: 61,
      serviceTimeMinutes: 5,
      totalWeightKg: 10,
      totalVolumeM3: 1,
    });
    expect(result.groups.find((group: any) => group.id === 'group-2')).toMatchObject({
      totalDurationMinutes: 99,
      serviceTimeMinutes: 25,
      totalWeightKg: 30,
      totalVolumeM3: 3,
    });
    expect(result.routePlan.status).toBe('DRAFT');
    expect(result.routePlan.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'MANUAL_BATCH_MOVE_REOPTIMIZE_REQUIRED',
        groupId: 'group-2',
        jobIds: ['job-1'],
      }),
    ]));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'route-plan.stops.batch-moved' }),
    );
  });

  it('rejects a batch move when any stop in the selected job bundle is protected', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', status: 'READY', warnings: [], metrics: {} }]);
    const routePlanGroups = createRepo([
      { id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1', vehicleId: 'veh-1' },
      { id: 'group-2', routePlanId: 'plan-1', groupIndex: 2, label: 'Route 2', vehicleId: 'veh-2' },
    ]);
    const routePlanStops = createRepo([
      { id: 'stop-a', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'job-stop-a', stopSequence: 1, isLocked: false },
      { id: 'stop-b', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'job-stop-b', stopSequence: 2, isLocked: true },
    ]);
    const service = createPlanningService(
      routePlans,
      routePlanGroups,
      routePlanStops,
      createRepo([{ id: 'job-1', organizationId: 'org-1' }]),
      createRepo(),
      createRepo(),
      createRepo(),
      createRepo(),
      createRepo(),
      createRepo(),
      createRepo(),
    );

    await expect(service.batchMoveStops(
      'plan-1',
      { stopIds: ['stop-a'], targetGroupId: 'group-2' },
      { userId: 'user-1', organizationId: 'org-1' },
    )).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ROUTE_BATCH_MOVE_PROTECTED',
        stopIds: ['stop-b'],
      }),
    });
  });

  it('rejects a batch move that would exceed the target vehicle capacity', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', status: 'READY', warnings: [], metrics: {} }]);
    const routePlanGroups = createRepo([
      { id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1', vehicleId: 'veh-1', totalDurationMinutes: 60, serviceTimeMinutes: 10, totalWeightKg: 20, totalVolumeM3: 1 },
      { id: 'group-2', routePlanId: 'plan-1', groupIndex: 2, label: 'Route 2', vehicleId: 'veh-2', totalDurationMinutes: 60, serviceTimeMinutes: 10, totalWeightKg: 90, totalVolumeM3: 1 },
    ]);
    const routePlanStops = createRepo([
      { id: 'stop-a', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'job-stop-a', stopSequence: 1, isLocked: false },
    ]);
    const service = createPlanningService(
      routePlans,
      routePlanGroups,
      routePlanStops,
      createRepo([{ id: 'job-1', organizationId: 'org-1', weight: 20, volume: 1 }]),
      createRepo([{ id: 'job-stop-a', jobId: 'job-1', serviceDurationMinutes: 10 }]),
      createRepo([
        { id: 'veh-1', organizationId: 'org-1', capacityWeightKg: 100, capacityVolumeM3: 20, metadata: { maxShiftMinutes: 480 } },
        { id: 'veh-2', organizationId: 'org-1', capacityWeightKg: 100, capacityVolumeM3: 20, metadata: { maxShiftMinutes: 480 } },
      ]),
      createRepo(),
      createRepo(),
      createRepo(),
      createRepo(),
      createRepo(),
    );

    await expect(service.batchMoveStops(
      'plan-1',
      { stopIds: ['stop-a'], targetGroupId: 'group-2' },
      { userId: 'user-1', organizationId: 'org-1' },
    )).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ROUTE_BATCH_MOVE_CONSTRAINT',
        constraints: expect.arrayContaining(['weight']),
      }),
    });
    expect(routePlanStops.items.find((stop: any) => stop.id === 'stop-a')?.routePlanGroupId).toBe('group-1');
  });

  it('rejects inserting a job owned by another organization', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'READY', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1' }]);
    const routePlanGroups = createRepo([{ id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1', vehicleId: 'veh-1', driverId: 'drv-1' }]);
    const routePlanStops = createRepo();
    const jobs = createRepo([{ id: 'job-org-2', organizationId: 'org-2', status: 'pending' }]);
    const jobStops = createRepo();
    const vehicles = createRepo([{ id: 'veh-1', organizationId: 'org-1' }]);
    const drivers = createRepo();
    const depots = createRepo();
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();
    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments);

    await expect(
      service.insertJob(
        'plan-1',
        'group-1',
        { jobId: 'job-org-2' },
        { userId: 'user-1', organizationId: 'org-1' },
      ),
    ).rejects.toThrow('Job not found: job-org-2');
    expect(routePlanStops.items).toHaveLength(0);
  });

  it('rejects reoptimize when the route plan belongs to another organization', async () => {
    const routePlans = createRepo([{ id: 'plan-2', organizationId: 'org-2', serviceDate: '2026-04-10', status: 'READY', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-2' }]);
    const routePlanGroups = createRepo([{ id: 'group-2', routePlanId: 'plan-2', groupIndex: 1, label: 'Route 2', vehicleId: 'veh-2' }]);
    const routePlanStops = createRepo([{ id: 'stop-2', routePlanId: 'plan-2', routePlanGroupId: 'group-2', jobId: 'job-2', jobStopId: 'job-stop-2', stopSequence: 1, isLocked: false }]);
    const jobs = createRepo();
    const jobStops = createRepo();
    const vehicles = createRepo();
    const drivers = createRepo();
    const depots = createRepo([{ id: 'dep-2', organizationId: 'org-2', isPrimary: true, name: 'Other', address: 'Other HQ' }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = createPlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments);

    await expect(service.reoptimize('plan-2', { userId: 'user-1', organizationId: 'org-1' })).rejects.toThrow('Route plan not found: plan-2');
  });
});
