import { ForbiddenException } from '@nestjs/common';
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
