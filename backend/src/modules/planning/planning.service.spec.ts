import { PlanningService } from './planning.service';

describe('PlanningService', () => {
  function createRepo(initial: any[] = []) {
    let items = [...initial];
    return {
      items,
      create: (value: any) => ({ ...value, id: value.id || `id-${Math.random().toString(36).slice(2, 8)}`, createdAt: value.createdAt || new Date(), updatedAt: new Date() }),
      save: jest.fn(async (value: any) => {
        if (Array.isArray(value)) {
          value.forEach((entry) => {
            const index = items.findIndex((candidate) => candidate.id === entry.id);
            if (index >= 0) items[index] = { ...items[index], ...entry };
            else items.push(entry);
          });
          return value;
        }
        const index = items.findIndex((candidate) => candidate.id === value.id);
        if (index >= 0) items[index] = { ...items[index], ...value };
        else items.push(value);
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

  it('generates a deterministic draft plan with grouped stops', async () => {
    const routePlans = createRepo();
    const routePlanGroups = createRepo();
    const routePlanStops = createRepo();
    const jobs = createRepo([
      { id: 'job-1', organizationId: 'org-1', customerName: 'A', deliveryAddress: 'A St', pickupAddress: '', status: 'pending', priority: 'urgent', createdAt: new Date('2026-04-10T08:00:00Z'), timeWindowStart: new Date('2026-04-10T09:00:00Z'), timeWindowEnd: new Date('2026-04-10T10:00:00Z'), weight: 10, volume: 1 },
      { id: 'job-2', organizationId: 'org-1', customerName: 'B', deliveryAddress: 'B St', pickupAddress: '', status: 'pending', priority: 'normal', createdAt: new Date('2026-04-10T08:05:00Z'), timeWindowStart: new Date('2026-04-10T10:00:00Z'), timeWindowEnd: new Date('2026-04-10T11:00:00Z'), weight: 5, volume: 1 },
    ]);
    const jobStops = createRepo();
    const vehicles = createRepo([{ id: 'veh-1', organizationId: 'org-1', status: 'available', licensePlate: 'TRK-1', capacityWeightKg: 100, capacityVolumeM3: 20, metadata: {} }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1' }]);
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ' }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = new PlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments, audit);
    const result = await service.generateDraft({ serviceDate: '2026-04-10', vehicleIds: ['veh-1'], objective: 'distance' }, { userId: 'user-1', organizationId: 'org-1' });

    expect(result.routePlan.status).toBe('READY');
    expect(result.groups).toHaveLength(1);
    expect(result.stops.length).toBeGreaterThan(0);
    expect(result.groups[0].vehicleId).toBe('veh-1');
  });

  it('publishes a route plan into live route runs', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'READY', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1' }]);
    const routePlanGroups = createRepo([{ id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1', vehicleId: 'veh-1', driverId: 'drv-1', totalDistanceKm: 12, totalDurationMinutes: 60 }]);
    const routePlanStops = createRepo([{ id: 'rps-1', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'stop-1', stopSequence: 1, isLocked: false, plannedArrival: new Date('2026-04-10T09:00:00Z') }]);
    const jobs = createRepo([{ id: 'job-1', organizationId: 'org-1', customerName: 'A', deliveryAddress: 'A St', status: 'pending' }]);
    const jobStops = createRepo([{ id: 'stop-1', jobId: 'job-1', stopOrder: 1, stopType: 'DROPOFF', address: 'A St', serviceDurationMinutes: 10 }]);
    const vehicles = createRepo([{ id: 'veh-1', organizationId: 'org-1', status: 'available', licensePlate: 'TRK-1' }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1' }]);
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ' }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = new PlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments, audit);
    const result = await service.publish('plan-1', { userId: 'user-1', organizationId: 'org-1' });

    expect(result.routePlan.status).toBe('PUBLISHED');
    expect(result.routeRuns).toHaveLength(1);
    expect(routeRunStops.save).toHaveBeenCalled();
    expect(routeAssignments.save).toHaveBeenCalled();
  });

  it('preserves locked stops when regenerating an existing draft plan', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'DRAFT', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1' }]);
    const routePlanGroups = createRepo([{ id: 'group-old', routePlanId: 'plan-1', groupIndex: 1, label: 'Old Route', vehicleId: 'veh-1', driverId: 'drv-1' }]);
    const routePlanStops = createRepo([{ id: 'locked-stop', routePlanId: 'plan-1', routePlanGroupId: 'group-old', jobId: 'job-1', jobStopId: 'stop-1', stopSequence: 1, isLocked: true }]);
    const jobs = createRepo([{ id: 'job-1', organizationId: 'org-1', customerName: 'A', deliveryAddress: 'A St', pickupAddress: '', status: 'pending', priority: 'urgent', createdAt: new Date('2026-04-10T08:00:00Z') }]);
    const jobStops = createRepo([{ id: 'stop-1', organizationId: 'org-1', jobId: 'job-1', stopOrder: 1, stopType: 'DROPOFF', address: 'A St', serviceDurationMinutes: 10 }]);
    const vehicles = createRepo([{ id: 'veh-1', organizationId: 'org-1', status: 'available', licensePlate: 'TRK-1', capacityWeightKg: 100, capacityVolumeM3: 20, metadata: {} }]);
    const drivers = createRepo([{ id: 'drv-1', organizationId: 'org-1' }]);
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ' }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = new PlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments, audit);
    const result = await service.generateDraft({ serviceDate: '2026-04-10', vehicleIds: ['veh-1'], objective: 'distance' }, { userId: 'user-1', organizationId: 'org-1' });

    expect(result.stops[0].isLocked).toBe(true);
  });

  it('resequences source and target groups when moving a stop', async () => {
    const routePlans = createRepo([{ id: 'plan-1', organizationId: 'org-1', serviceDate: '2026-04-10', status: 'READY', objective: 'distance', warnings: [], metrics: {}, depotId: 'dep-1' }]);
    const routePlanGroups = createRepo([
      { id: 'group-1', routePlanId: 'plan-1', groupIndex: 1, label: 'Route 1', vehicleId: 'veh-1' },
      { id: 'group-2', routePlanId: 'plan-1', groupIndex: 2, label: 'Route 2', vehicleId: 'veh-2' },
    ]);
    const routePlanStops = createRepo([
      { id: 'stop-a', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-1', jobStopId: 'job-stop-1', stopSequence: 1, isLocked: false, createdAt: new Date('2026-04-10T08:00:00Z') },
      { id: 'stop-b', routePlanId: 'plan-1', routePlanGroupId: 'group-1', jobId: 'job-2', jobStopId: 'job-stop-2', stopSequence: 2, isLocked: false, createdAt: new Date('2026-04-10T08:05:00Z') },
      { id: 'stop-c', routePlanId: 'plan-1', routePlanGroupId: 'group-2', jobId: 'job-3', jobStopId: 'job-stop-3', stopSequence: 1, isLocked: false, createdAt: new Date('2026-04-10T08:10:00Z') },
    ]);
    const jobs = createRepo();
    const jobStops = createRepo();
    const vehicles = createRepo();
    const drivers = createRepo();
    const depots = createRepo([{ id: 'dep-1', organizationId: 'org-1', isPrimary: true, name: 'Main', address: 'HQ' }]);
    const routes = createRepo();
    const routeRunStops = createRepo();
    const routeAssignments = createRepo();

    const service = new PlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments, audit);
    const result = await service.updateStop('plan-1', 'stop-b', { targetGroupId: 'group-2', targetSequence: 1 }, { userId: 'user-1', organizationId: 'org-1' });

    const group1Stops = result.stops.filter((stop: any) => stop.routePlanGroupId === 'group-1').sort((a: any, b: any) => a.stopSequence - b.stopSequence);
    const group2Stops = result.stops.filter((stop: any) => stop.routePlanGroupId === 'group-2').sort((a: any, b: any) => a.stopSequence - b.stopSequence);

    expect(group1Stops.map((stop: any) => stop.id)).toEqual(['stop-a']);
    expect(group1Stops.map((stop: any) => stop.stopSequence)).toEqual([1]);
    expect(group2Stops.map((stop: any) => stop.id)).toEqual(['stop-b', 'stop-c']);
    expect(group2Stops.map((stop: any) => stop.stopSequence)).toEqual([1, 2]);
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

    const service = new PlanningService(routePlans, routePlanGroups, routePlanStops, jobs, jobStops, vehicles, drivers, depots, routes, routeRunStops, routeAssignments, audit);

    await expect(service.reoptimize('plan-2', { userId: 'user-1', organizationId: 'org-1' })).rejects.toThrow('Route plan not found: plan-2');
  });
});
