import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Telemetry } from './entities/telemetry.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';

export interface VehicleLocation {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  vehicleInfo?: {
    licensePlate: string;
    make: string;
    model: string;
    status: string;
  };
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    @InjectRepository(Telemetry)
    private readonly telemetryRepository: Repository<Telemetry>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {}

  /**
   * Get latest location for all vehicles
   */
  async getLatestVehicleLocations(): Promise<VehicleLocation[]> {
    this.logger.debug('Fetching latest vehicle locations from telemetry');

    // Get latest telemetry record for each vehicle using window function
    const query = `
      WITH latest_telemetry AS (
        SELECT DISTINCT ON (vehicle_id)
          id,
          vehicle_id,
          (location->>'lat')::float as latitude,
          (location->>'lng')::float as longitude,
          speed,
          heading,
          timestamp
        FROM telemetry
        WHERE timestamp > NOW() - INTERVAL '1 hour'
        ORDER BY vehicle_id, timestamp DESC
      )
      SELECT
        lt.vehicle_id as "vehicleId",
        lt.latitude,
        lt.longitude,
        lt.speed,
        lt.heading,
        lt.timestamp,
        v.license_plate as "licensePlate",
        v.make,
        v.model,
        v.status,
        v.vehicle_type as "vehicleType"
      FROM latest_telemetry lt
      INNER JOIN vehicles v ON v.id = lt.vehicle_id
      WHERE v.deleted_at IS NULL
      ORDER BY lt.timestamp DESC
    `;

    const results = await this.telemetryRepository.query(query);

    return results.map((row: any) => ({
      vehicleId: row.vehicleId,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      speed: row.speed ? parseFloat(row.speed) : undefined,
      heading: row.heading ? parseFloat(row.heading) : undefined,
      timestamp: row.timestamp,
      vehicleInfo: {
        licensePlate: row.licensePlate,
        make: row.make,
        model: row.model,
        status: row.status,
        vehicleType: row.vehicleType,
      },
    }));
  }

  /**
   * Get location history for a specific vehicle
   */
  async getVehicleLocationHistory(
    vehicleId: string,
    hours: number = 24,
  ): Promise<VehicleLocation[]> {
    const query = `
      SELECT
        vehicle_id as "vehicleId",
        (location->>'lat')::float as latitude,
        (location->>'lng')::float as longitude,
        speed,
        heading,
        timestamp
      FROM telemetry
      WHERE vehicle_id = $1
        AND timestamp > NOW() - INTERVAL '${hours} hours'
      ORDER BY timestamp DESC
      LIMIT 1000
    `;

    const results = await this.telemetryRepository.query(query, [vehicleId]);

    return results.map((row: any) => ({
      vehicleId: row.vehicleId,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      speed: row.speed ? parseFloat(row.speed) : undefined,
      heading: row.heading ? parseFloat(row.heading) : undefined,
      timestamp: row.timestamp,
    }));
  }

  /**
   * Get telemetry statistics
   */
  async getStatistics() {
    const [totalRecords, vehicleCount, oldestRecord, newestRecord] =
      await Promise.all([
        this.telemetryRepository.count(),
        this.telemetryRepository
          .createQueryBuilder('telemetry')
          .select('COUNT(DISTINCT telemetry.vehicle_id)', 'count')
          .getRawOne(),
        this.telemetryRepository
          .createQueryBuilder('telemetry')
          .orderBy('telemetry.timestamp', 'ASC')
          .limit(1)
          .getOne(),
        this.telemetryRepository
          .createQueryBuilder('telemetry')
          .orderBy('telemetry.timestamp', 'DESC')
          .limit(1)
          .getOne(),
      ]);

    return {
      totalRecords,
      vehiclesTracked: parseInt(vehicleCount?.count || '0'),
      oldestRecord: oldestRecord?.timestamp,
      newestRecord: newestRecord?.timestamp,
    };
  }
}
