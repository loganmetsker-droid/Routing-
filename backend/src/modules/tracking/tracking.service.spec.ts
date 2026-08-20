import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TrackingService } from './tracking.service';

function repo(overrides: Record<string, unknown> = {}) {
  return {
    findOne: vi.fn(),
    update: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => ({ ...value, timestamp: value.timestamp ?? new Date() })),
    createQueryBuilder: vi.fn(),
    count: vi.fn(),
    ...overrides,
  } as any;
}

describe('TrackingService telemetry ingest authorization', () => {
  it('allows a driver to ingest telemetry for their assigned vehicle', async () => {
    const vehicleRepository = repo({
      findOne: vi.fn(async () => ({ id: 'vehicle-1', organizationId: 'org-1' })),
    });
    const driverRepository = repo({
      findOne: vi.fn(async () => ({
        id: 'driver-1',
        organizationId: 'org-1',
        email: 'driver@example.test',
        currentVehicleId: 'vehicle-1',
      })),
    });
    const telemetryRepository = repo();
    const service = new TrackingService(
      telemetryRepository,
      vehicleRepository,
      driverRepository,
    );

    await expect(
      service.ingestTelemetry(
        {
          vehicleId: 'vehicle-1',
          lat: 41,
          lng: -87,
          organizationId: 'org-1',
        },
        {
          email: 'driver@example.test',
          organizationId: 'org-1',
          roles: ['DRIVER'],
        },
      ),
    ).resolves.toMatchObject({ vehicleId: 'vehicle-1' });
  });

  it('denies a driver ingesting telemetry for an unassigned vehicle', async () => {
    const service = new TrackingService(
      repo(),
      repo({
        findOne: vi.fn(async () => ({ id: 'vehicle-2', organizationId: 'org-1' })),
      }),
      repo({
        findOne: vi.fn(async () => ({
          id: 'driver-1',
          organizationId: 'org-1',
          email: 'driver@example.test',
          currentVehicleId: 'vehicle-1',
        })),
      }),
    );

    await expect(
      service.ingestTelemetry(
        {
          vehicleId: 'vehicle-2',
          lat: 41,
          lng: -87,
          organizationId: 'org-1',
        },
        {
          email: 'driver@example.test',
          organizationId: 'org-1',
          roles: ['DRIVER'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies operator location spoofing unless explicitly enabled', async () => {
    const service = new TrackingService(
      repo(),
      repo({
        findOne: vi.fn(async () => ({ id: 'vehicle-1', organizationId: 'org-1' })),
      }),
      repo(),
    );

    await expect(
      service.ingestTelemetry(
        {
          vehicleId: 'vehicle-1',
          lat: 41,
          lng: -87,
          organizationId: 'org-1',
        },
        {
          email: 'dispatcher@example.test',
          organizationId: 'org-1',
          roles: ['DISPATCHER'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('TrackingService vehicle history', () => {
  const historyQuery = (rows: Array<Record<string, unknown>>) => ({
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getRawMany: vi.fn(async () => rows),
  });

  it('scopes vehicle access, bounds the range, and returns recent points chronologically', async () => {
    const query = historyQuery([
      {
        vehicleId: 'vehicle-1',
        latitude: '39.8',
        longitude: '-104.9',
        speed: '30',
        heading: '90',
        timestamp: '2026-08-04T12:05:00.000Z',
      },
      {
        vehicleId: 'vehicle-1',
        latitude: '39.7',
        longitude: '-105',
        speed: null,
        heading: null,
        timestamp: '2026-08-04T12:00:00.000Z',
      },
    ]);
    const vehicleRepository = repo({
      findOne: vi.fn(async () => ({ id: 'vehicle-1', organizationId: 'org-1' })),
    });
    const service = new TrackingService(
      repo({ createQueryBuilder: vi.fn(() => query) }),
      vehicleRepository,
      repo(),
    );

    const history = await service.getVehicleLocationHistory(
      'vehicle-1',
      999,
      'org-1',
    );

    expect(vehicleRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'vehicle-1', organizationId: 'org-1' },
      withDeleted: false,
    });
    expect(query.andWhere).toHaveBeenCalledWith(
      "telemetry.timestamp >= NOW() - (:hours * INTERVAL '1 hour')",
      { hours: 168 },
    );
    expect(query.limit).toHaveBeenCalledWith(1000);
    expect(history.map((point) => point.timestamp)).toEqual([
      '2026-08-04T12:00:00.000Z',
      '2026-08-04T12:05:00.000Z',
    ]);
  });

  it('does not query telemetry when the scoped vehicle is unavailable', async () => {
    const telemetryRepository = repo({ createQueryBuilder: vi.fn() });
    const service = new TrackingService(
      telemetryRepository,
      repo({ findOne: vi.fn(async () => null) }),
      repo(),
    );

    await expect(
      service.getVehicleLocationHistory('vehicle-foreign', 6, 'org-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(telemetryRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
