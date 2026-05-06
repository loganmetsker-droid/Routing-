import { PublicApiController } from './public-api.controller';

describe('PublicApiController', () => {
  function createRepo(initial: any[] = []) {
    return {
      find: vi.fn(async ({ where }: any = {}) =>
        initial.filter((item) =>
          !where
            ? true
            : Object.entries(where).every(([key, value]) => item[key] === value),
        ),
      ),
      findOne: vi.fn(async ({ where }: any = {}) =>
        initial.find((item) =>
          !where
            ? true
            : Object.entries(where).every(([key, value]) => item[key] === value),
        ) || null,
      ),
      findOneOrFail: vi.fn(async ({ where }: any = {}) => {
        const item =
          initial.find((candidate) =>
            Object.entries(where).every(([key, value]) => candidate[key] === value),
          ) || null;
        if (!item) {
          throw new Error('not found');
        }
        return item;
      }),
    } as any;
  }

  it('scopes public API route tracking telemetry through the route organization', async () => {
    const telemetry = {
      findOne: vi.fn(async ({ where }: any) => {
        if (
          where.vehicleId === 'vehicle-1' &&
          where.vehicle?.organizationId === 'org-1'
        ) {
          return {
            id: 'telemetry-1',
            vehicleId: 'vehicle-1',
            vehicle: { organizationId: 'org-1' },
            timestamp: new Date('2026-05-06T12:00:00.000Z'),
          };
        }
        return null;
      }),
    } as any;

    const controller = new PublicApiController(
      createRepo(),
      createRepo(),
      createRepo(),
      createRepo(),
      createRepo([{ id: 'route-1', organizationId: 'org-1', vehicleId: 'vehicle-1' }]),
      createRepo(),
      createRepo(),
      createRepo(),
      telemetry,
    );

    const response = await controller.routeRunTracking(
      { apiKey: { organizationId: 'org-1', scopes: ['route-runs:read'] } },
      'route-1',
    );

    expect(response.latestTelemetry?.id).toBe('telemetry-1');
    expect(telemetry.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          vehicleId: 'vehicle-1',
          vehicle: { organizationId: 'org-1' },
        },
      }),
    );
  });
});
