import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Telemetry } from './entities/telemetry.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Driver } from '../drivers/entities/driver.entity';

export type TrackingActorContext = {
  userId?: string;
  email?: string;
  organizationId?: string;
  role?: string;
  roles?: string[];
};

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
    vehicleType?: string;
  };
}

export interface TrackingOverview {
  organizationId?: string;
  generatedAt: string;
  vehicles: VehicleLocation[];
  summary: {
    activeVehicles: number;
    staleVehicles: number;
    totalVehiclesInOrganization: number;
    newestRecord?: Date;
    oldestRecord?: Date;
  };
}

export interface TrackingReadiness {
  ready: boolean;
  checkedAt: string;
  organizationId?: string;
  summary: {
    telemetryRecords: number;
    vehiclesTracked: number;
    activeVehicles: number;
    latestTelemetryAt?: Date;
  };
}

export interface TelemetryIngestInput {
  vehicleId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  odometer?: number;
  fuelLevel?: number;
  engineTemp?: number;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  organizationId?: string;
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    @InjectRepository(Telemetry)
    private readonly telemetryRepository: Repository<Telemetry>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
  ) {}

  private mapLocationRow(row: any): VehicleLocation {
    return {
      vehicleId: row.vehicleId,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      speed: row.speed !== null && row.speed !== undefined ? parseFloat(row.speed) : undefined,
      heading:
        row.heading !== null && row.heading !== undefined
          ? parseFloat(row.heading)
          : undefined,
      timestamp: row.timestamp,
      vehicleInfo: {
        licensePlate: row.licensePlate,
        make: row.make,
        model: row.model,
        status: row.status,
        vehicleType: row.vehicleType,
      },
    };
  }

  private async findVehicleForOrganization(vehicleId: string, organizationId?: string) {
    const vehicle = await this.vehicleRepository.findOne({
      where: organizationId ? { id: vehicleId, organizationId } : { id: vehicleId },
      withDeleted: false,
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle not found: ${vehicleId}`);
    }

    if (
      organizationId &&
      vehicle.organizationId &&
      vehicle.organizationId !== organizationId
    ) {
      throw new NotFoundException(`Vehicle not found: ${vehicleId}`);
    }

    return vehicle;
  }

  private actorRoles(actor?: TrackingActorContext) {
    const roles = Array.isArray(actor?.roles) ? actor?.roles : actor?.role ? [actor.role] : [];
    return roles.map((role) => String(role).trim().toUpperCase());
  }

  private async assertTelemetryIngestAllowed(
    vehicle: Vehicle,
    actor?: TrackingActorContext,
  ) {
    const roles = this.actorRoles(actor);
    const isDriver = roles.includes('DRIVER');
    const operatorOverrideAllowed =
      String(process.env.ALLOW_OPERATOR_LOCATION_INGEST || 'false') === 'true';
    const isOperator = roles.some((role) =>
      ['OWNER', 'ADMIN', 'DISPATCHER'].includes(role),
    );

    if (isOperator && operatorOverrideAllowed) {
      return;
    }

    if (!isDriver || !actor?.email || !actor.organizationId) {
      throw new ForbiddenException('Driver assignment is required to ingest location');
    }

    const driver = await this.driverRepository.findOne({
      where: {
        email: actor.email,
        organizationId: actor.organizationId,
      },
    });

    if (!driver || driver.currentVehicleId !== vehicle.id) {
      throw new ForbiddenException('Driver is not assigned to this vehicle');
    }
  }

  /**
   * Get latest location for all vehicles
   */
  async getLatestVehicleLocations(options?: {
    organizationId?: string;
    freshnessMinutes?: number;
  }): Promise<VehicleLocation[]> {
    const freshnessMinutes = Math.max(1, Math.min(24 * 60, options?.freshnessMinutes ?? 60));
    this.logger.debug(
      `Fetching latest vehicle locations from telemetry (org=${options?.organizationId ?? 'all'}, freshnessMinutes=${freshnessMinutes})`,
    );

    const query = this.telemetryRepository
      .createQueryBuilder('telemetry')
      .innerJoin(Vehicle, 'vehicle', 'vehicle.id = telemetry.vehicle_id')
      .select('telemetry.vehicle_id', 'vehicleId')
      .addSelect("(telemetry.location->>'lat')::float", 'latitude')
      .addSelect("(telemetry.location->>'lng')::float", 'longitude')
      .addSelect('telemetry.speed', 'speed')
      .addSelect('telemetry.heading', 'heading')
      .addSelect('telemetry.timestamp', 'timestamp')
      .addSelect('vehicle.license_plate', 'licensePlate')
      .addSelect('vehicle.make', 'make')
      .addSelect('vehicle.model', 'model')
      .addSelect('vehicle.status', 'status')
      .addSelect('vehicle.vehicle_type', 'vehicleType')
      .where('vehicle.deleted_at IS NULL')
      .andWhere(
        `telemetry.id IN (
          SELECT DISTINCT ON (inner_telemetry.vehicle_id) inner_telemetry.id
          FROM telemetry inner_telemetry
          ORDER BY inner_telemetry.vehicle_id, inner_telemetry.timestamp DESC
        )`,
      )
      .andWhere('telemetry.timestamp >= NOW() - (:freshnessMinutes * INTERVAL \'1 minute\')', {
        freshnessMinutes,
      })
      .orderBy('telemetry.timestamp', 'DESC');

    if (options?.organizationId) {
      query.andWhere('vehicle.organization_id = :organizationId', {
        organizationId: options.organizationId,
      });
    }

    const results = await query.getRawMany();
    return results.map((row: any) => this.mapLocationRow(row));
  }

  /**
   * Get location history for a specific vehicle
   */
  async getVehicleLocationHistory(
    vehicleId: string,
    hours: number = 24,
    organizationId?: string,
  ): Promise<VehicleLocation[]> {
    const boundedHours = Math.max(1, Math.min(24 * 7, hours));
    await this.findVehicleForOrganization(vehicleId, organizationId);

    const results = await this.telemetryRepository
      .createQueryBuilder('telemetry')
      .select('telemetry.vehicle_id', 'vehicleId')
      .addSelect("(telemetry.location->>'lat')::float", 'latitude')
      .addSelect("(telemetry.location->>'lng')::float", 'longitude')
      .addSelect('telemetry.speed', 'speed')
      .addSelect('telemetry.heading', 'heading')
      .addSelect('telemetry.timestamp', 'timestamp')
      .where('telemetry.vehicle_id = :vehicleId', { vehicleId })
      .andWhere('telemetry.timestamp >= NOW() - (:hours * INTERVAL \'1 hour\')', {
        hours: boundedHours,
      })
      .orderBy('telemetry.timestamp', 'DESC')
      .limit(1000)
      .getRawMany();

    return results.map((row: any) => ({
      vehicleId: row.vehicleId,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      speed: row.speed !== null && row.speed !== undefined ? parseFloat(row.speed) : undefined,
      heading:
        row.heading !== null && row.heading !== undefined
          ? parseFloat(row.heading)
          : undefined,
      timestamp: row.timestamp,
    }));
  }

  async getOverview(options?: {
    organizationId?: string;
    freshnessMinutes?: number;
  }): Promise<TrackingOverview> {
    const [vehicles, stats, totalVehiclesInOrganization] = await Promise.all([
      this.getLatestVehicleLocations(options),
      this.getStatistics(options?.organizationId),
      this.vehicleRepository.count({
        where: options?.organizationId ? { organizationId: options.organizationId } : {},
      }),
    ]);

    return {
      organizationId: options?.organizationId,
      generatedAt: new Date().toISOString(),
      vehicles,
      summary: {
        activeVehicles: vehicles.length,
        staleVehicles: Math.max(totalVehiclesInOrganization - vehicles.length, 0),
        totalVehiclesInOrganization,
        newestRecord: stats.newestRecord,
        oldestRecord: stats.oldestRecord,
      },
    };
  }

  /**
   * Get telemetry statistics
   */
  async getStatistics(organizationId?: string) {
    const baseQuery = this.telemetryRepository
      .createQueryBuilder('telemetry')
      .innerJoin(Vehicle, 'vehicle', 'vehicle.id = telemetry.vehicle_id')
      .where('vehicle.deleted_at IS NULL');

    if (organizationId) {
      baseQuery.andWhere('vehicle.organization_id = :organizationId', { organizationId });
    }

    const [totalRecords, vehicleCount, oldestRecord, newestRecord] = await Promise.all([
      baseQuery.clone().getCount(),
      baseQuery
        .clone()
        .select('COUNT(DISTINCT telemetry.vehicle_id)', 'count')
        .getRawOne(),
      baseQuery
        .clone()
        .select('telemetry.timestamp', 'timestamp')
        .orderBy('telemetry.timestamp', 'ASC')
        .limit(1)
        .getRawOne(),
      baseQuery
        .clone()
        .select('telemetry.timestamp', 'timestamp')
        .orderBy('telemetry.timestamp', 'DESC')
        .limit(1)
        .getRawOne(),
    ]);

    return {
      totalRecords,
      vehiclesTracked: parseInt(vehicleCount?.count || '0'),
      oldestRecord: oldestRecord?.timestamp ? new Date(oldestRecord.timestamp) : undefined,
      newestRecord: newestRecord?.timestamp ? new Date(newestRecord.timestamp) : undefined,
    };
  }

  async getReadiness(organizationId?: string): Promise<TrackingReadiness> {
    const [overview, stats] = await Promise.all([
      this.getOverview({ organizationId }),
      this.getStatistics(organizationId),
    ]);

    return {
      ready: true,
      checkedAt: new Date().toISOString(),
      organizationId,
      summary: {
        telemetryRecords: stats.totalRecords,
        vehiclesTracked: stats.vehiclesTracked,
        activeVehicles: overview.summary.activeVehicles,
        latestTelemetryAt: stats.newestRecord,
      },
    };
  }

  async ingestTelemetry(input: TelemetryIngestInput, actor?: TrackingActorContext) {
    if (!input.vehicleId) {
      throw new BadRequestException('vehicleId is required');
    }
    if (typeof input.lat !== 'number' || Number.isNaN(input.lat)) {
      throw new BadRequestException('lat must be a valid number');
    }
    if (typeof input.lng !== 'number' || Number.isNaN(input.lng)) {
      throw new BadRequestException('lng must be a valid number');
    }

    const vehicle = await this.findVehicleForOrganization(
      input.vehicleId,
      input.organizationId,
    );
    await this.assertTelemetryIngestAllowed(vehicle, actor);
    const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();

    if (Number.isNaN(timestamp.getTime())) {
      throw new BadRequestException('timestamp must be a valid ISO-8601 date');
    }

    await this.vehicleRepository.update(vehicle.id, {
      currentLocation: { lat: input.lat, lng: input.lng } as any,
      ...(typeof input.odometer === 'number'
        ? { currentOdometerKm: input.odometer }
        : {}),
    });

    const telemetry = this.telemetryRepository.create({
      vehicleId: vehicle.id,
      location: { lat: input.lat, lng: input.lng },
      speed: typeof input.speed === 'number' ? input.speed : null,
      heading: typeof input.heading === 'number' ? input.heading : null,
      odometer: typeof input.odometer === 'number' ? input.odometer : null,
      fuelLevel: typeof input.fuelLevel === 'number' ? input.fuelLevel : null,
      engineTemp: typeof input.engineTemp === 'number' ? input.engineTemp : null,
      timestamp,
      metadata: input.metadata ?? null,
    });

    await this.telemetryRepository.save(telemetry);

    return {
      vehicleId: vehicle.id,
      organizationId: vehicle.organizationId,
      location: {
        lat: input.lat,
        lng: input.lng,
      },
      speed: input.speed,
      heading: input.heading,
      timestamp: telemetry.timestamp.toISOString(),
      persisted: true,
    };
  }
}
