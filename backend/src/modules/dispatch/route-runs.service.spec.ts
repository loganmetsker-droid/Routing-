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
});
