import { RouteRunsService } from './route-runs.service';

describe('RouteRunsService', () => {
  function createRepo(initial: any[] = []) {
    let items = [...initial];
    return {
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
          out = out.filter((item) => Object.entries(where).every(([key, val]) => {
            if (Array.isArray((val as any)?._value)) return (val as any)._value.includes(item[key]);
            return item[key] === val;
          }));
        }
        if (order) {
          const [key, dir] = Object.entries(order)[0] as [string, any];
          out.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (dir === 'DESC' ? -1 : 1));
        }
        return out;
      }),
    } as any;
  }

  const audit = { record: jest.fn() } as any;

  it('creates an exception when a stop fails and resolves it', async () => {
    const routes = createRepo([{ id: 'route-1', organizationId: 'org-1', status: 'assigned', workflowStatus: 'ready_for_dispatch' }]);
    const routeRunStops = createRepo([{ id: 'stop-1', organizationId: 'org-1', routeId: 'route-1', status: 'DISPATCHED', stopSequence: 1 }]);
    const assignments = createRepo();
    const events = createRepo();
    const exceptions = createRepo();
    const proofs = createRepo();

    const service = new RouteRunsService(routes, routeRunStops, assignments, events, exceptions, proofs, audit);
    const failed = await service.failStop('stop-1', 'Customer unavailable', { userId: 'user-1', organizationId: 'org-1' });

    expect(failed.stop.status).toBe('FAILED');
    expect(failed.exception.code).toBe('STOP_FAILED');

    const resolved = await service.resolveException(failed.exception.id, { userId: 'user-1', organizationId: 'org-1' }, 'RESOLVED');
    expect(resolved.exception.status).toBe('RESOLVED');
  });

  it('adds notes without resetting stop status and exposes timeline/proofs', async () => {
    const routes = createRepo([{ id: 'route-1', organizationId: 'org-1', status: 'in_progress', workflowStatus: 'in_progress' }]);
    const routeRunStops = createRepo([{ id: 'stop-1', organizationId: 'org-1', routeId: 'route-1', status: 'ARRIVED', stopSequence: 1 }]);
    const assignments = createRepo();
    const events = createRepo();
    const exceptions = createRepo();
    const proofs = createRepo();

    const service = new RouteRunsService(routes, routeRunStops, assignments, events, exceptions, proofs, audit);
    const noted = await service.addNote('stop-1', 'Gate code required', { userId: 'user-1', organizationId: 'org-1' });
    const proof = await service.addProof('stop-1', { type: 'PHOTO', uri: 'https://example.test/proof.jpg' }, { userId: 'user-1', organizationId: 'org-1' });
    const timeline = await service.getStopTimeline('stop-1', { userId: 'user-1', organizationId: 'org-1' });
    const proofList = await service.getStopProofs('stop-1', { userId: 'user-1', organizationId: 'org-1' });

    expect(noted.stop.status).toBe('ARRIVED');
    expect(noted.stop.notes).toBe('Gate code required');
    expect(timeline.events.map((event: any) => event.eventType)).toContain('NOTE_ADDED');
    expect(proof.proof.type).toBe('PHOTO');
    expect(proofList.proofs).toHaveLength(1);
  });

  it('records audit entries for route and stop lifecycle transitions', async () => {
    audit.record.mockClear();
    const routes = createRepo([{ id: 'route-1', organizationId: 'org-1', status: 'assigned', workflowStatus: 'ready_for_dispatch' }]);
    const routeRunStops = createRepo([{ id: 'stop-1', organizationId: 'org-1', routeId: 'route-1', status: 'DISPATCHED', stopSequence: 1 }]);
    const assignments = createRepo();
    const events = createRepo();
    const exceptions = createRepo();
    const proofs = createRepo();

    const service = new RouteRunsService(routes, routeRunStops, assignments, events, exceptions, proofs, audit);
    await service.startRoute('route-1', { userId: 'user-1', organizationId: 'org-1' });
    await service.markArrived('stop-1', { userId: 'user-1', organizationId: 'org-1' });
    await service.markServiced('stop-1', { userId: 'user-1', organizationId: 'org-1' });
    await service.completeRoute('route-1', { userId: 'user-1', organizationId: 'org-1' });

    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'route_run',
      entityId: 'route-1',
      action: 'route-run.started',
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'route_run_stop',
      entityId: 'stop-1',
      action: 'route-run-stop.serviced',
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'route_run',
      entityId: 'route-1',
      action: 'route-run.completed',
    }));
  });

  it('creates manual exceptions for either a route or a stop and keeps them open in the queue', async () => {
    audit.record.mockClear();
    const routes = createRepo([{ id: 'route-1', organizationId: 'org-1', status: 'assigned', workflowStatus: 'ready_for_dispatch' }]);
    const routeRunStops = createRepo([{ id: 'stop-1', organizationId: 'org-1', routeId: 'route-1', jobId: 'job-1', status: 'DISPATCHED', stopSequence: 1 }]);
    const assignments = createRepo();
    const events = createRepo();
    const exceptions = createRepo();
    const proofs = createRepo();

    const service = new RouteRunsService(routes, routeRunStops, assignments, events, exceptions, proofs, audit);
    const routeLevel = await service.createException(
      {
        routeId: 'route-1',
        code: 'WEATHER_DELAY',
        message: 'Storm cell approaching the service area',
      },
      { userId: 'dispatcher-1', organizationId: 'org-1', roles: ['DISPATCHER'] },
    );
    const stopLevel = await service.createException(
      {
        routeRunStopId: 'stop-1',
        code: 'ACCESS_ISSUE',
        message: 'Loading dock is blocked',
        details: { dock: 'B2' },
      },
      { userId: 'dispatcher-1', organizationId: 'org-1', roles: ['DISPATCHER'] },
    );
    const listed = await service.listExceptions('org-1');

    expect(routeLevel.exception.status).toBe('OPEN');
    expect(routeLevel.exception.routeId).toBe('route-1');
    expect(routeLevel.exception.routeRunStopId).toBeNull();
    expect(stopLevel.exception.status).toBe('OPEN');
    expect(stopLevel.exception.routeRunStopId).toBe('stop-1');
    expect(listed.exceptions).toHaveLength(2);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'exception',
      action: 'exception.created',
    }));
  });

  it('creates branded public tracking links and scopes driver manifests to the authenticated driver', async () => {
    const routes = createRepo([
      {
        id: 'route-1',
        organizationId: 'org-1',
        status: 'assigned',
        workflowStatus: 'ready_for_dispatch',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        jobCount: 2,
      },
      {
        id: 'route-2',
        organizationId: 'org-1',
        status: 'assigned',
        workflowStatus: 'ready_for_dispatch',
        vehicleId: 'vehicle-2',
        driverId: 'driver-2',
        jobCount: 1,
      },
    ]);
    const routeRunStops = createRepo([
      {
        id: 'stop-1',
        organizationId: 'org-1',
        routeId: 'route-1',
        jobId: 'job-1',
        jobStopId: 'job-stop-1',
        status: 'PENDING',
        stopSequence: 1,
      },
      {
        id: 'stop-2',
        organizationId: 'org-1',
        routeId: 'route-1',
        jobId: 'job-2',
        jobStopId: 'job-stop-2',
        status: 'PENDING',
        stopSequence: 2,
      },
    ]);
    const assignments = createRepo();
    const events = createRepo();
    const exceptions = createRepo();
    const proofs = createRepo();
    const drivers = createRepo([
      {
        id: 'driver-1',
        organizationId: 'org-1',
        email: 'driver@example.com',
        firstName: 'Ava',
        lastName: 'Stone',
        phone: '555-0100',
        currentVehicleId: 'vehicle-1',
      },
    ]);
    const vehicles = createRepo([
      {
        id: 'vehicle-1',
        make: 'Ford',
        model: 'Transit',
        licensePlate: 'ABC-123',
        status: 'in_use',
      },
    ]);
    const telemetry = createRepo([
      {
        id: 'telemetry-1',
        vehicleId: 'vehicle-1',
        location: { lat: 39.75, lng: -104.99 },
        speed: 17,
        heading: 92,
        timestamp: new Date('2026-04-21T18:15:00.000Z'),
      },
    ]);
    const organizations = createRepo([
      {
        id: 'org-1',
        name: 'Acme Routing',
        slug: 'acme-routing',
        settings: {
          branding: {
            brandName: 'Acme Routing',
            trackingHeadline: 'Your order is on the move',
          },
        },
      },
    ]);
    const jwtService = {
      signAsync: jest.fn(async () => 'signed-token'),
      verifyAsync: jest.fn(async () => ({
        kind: 'public-tracking',
        routeId: 'route-1',
        organizationId: 'org-1',
        exp: Math.floor(new Date('2026-04-28T18:15:00.000Z').getTime() / 1000),
      })),
    } as any;

    const service = new RouteRunsService(
      routes,
      routeRunStops,
      assignments,
      events,
      exceptions,
      proofs,
      audit,
      drivers,
      vehicles,
      telemetry,
      organizations,
      jwtService,
    );

    const shareLink = await service.createPublicTrackingLink('route-1', {
      userId: 'dispatcher-1',
      organizationId: 'org-1',
      roles: ['DISPATCHER'],
    });
    const publicTracking = await service.getPublicTracking(shareLink.token);
    const manifest = await service.getDriverManifest({
      userId: 'user-1',
      email: 'driver@example.com',
      organizationId: 'org-1',
      roles: ['DRIVER'],
    });

    expect(shareLink.url).toContain('/track/signed-token');
    expect(publicTracking.organization.branding.brandName).toBe('Acme Routing');
    expect(publicTracking.latestTelemetry).toEqual(
      expect.objectContaining({
        latitude: 39.75,
        longitude: -104.99,
      }),
    );
    expect(manifest.routes).toHaveLength(1);
    expect(manifest.routes[0].routeRun.id).toBe('route-1');
    await expect(
      service.detail('route-2', {
        userId: 'user-1',
        email: 'driver@example.com',
        organizationId: 'org-1',
        roles: ['DRIVER'],
      }),
    ).rejects.toThrow('Route run not found: route-2');
  });
});
