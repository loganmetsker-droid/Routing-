import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TelemetryIngestDto } from './telemetry-ingest.dto';

describe('TelemetryIngestDto', () => {
  it('accepts valid telemetry payloads', async () => {
    const dto = plainToInstance(TelemetryIngestDto, {
      vehicleId: '018f3b8d-4d2f-4a56-9a2b-123456789abc',
      lat: 30.2672,
      lng: -97.7431,
      speed: 42,
      heading: 180,
      fuelLevel: 84,
      timestamp: '2026-04-24T12:00:00.000Z',
      metadata: { source: 'unit-test' },
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects malformed identifiers and impossible GPS ranges', async () => {
    const dto = plainToInstance(TelemetryIngestDto, {
      vehicleId: 'vehicle-1',
      lat: 120,
      lng: -200,
      speed: -1,
      heading: 361,
      fuelLevel: 101,
      timestamp: 'not-a-date',
    });

    const properties = (await validate(dto)).map((error) => error.property);

    expect(properties).toEqual(
      expect.arrayContaining([
        'vehicleId',
        'lat',
        'lng',
        'speed',
        'heading',
        'fuelLevel',
        'timestamp',
      ]),
    );
  });
});
