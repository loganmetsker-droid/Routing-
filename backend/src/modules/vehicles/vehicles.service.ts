import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

type Actor = {
  organizationId?: string;
};

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {}

  private requireOrganizationId(actor?: Actor) {
    if (!actor?.organizationId) {
      throw new ForbiddenException('Organization scope required');
    }
    return actor.organizationId;
  }

  private scopedWhere(
    actor: Actor | undefined,
    where: FindOptionsWhere<Vehicle> = {},
  ): FindOptionsWhere<Vehicle> {
    return {
      ...where,
      organizationId: this.requireOrganizationId(actor),
    };
  }

  /**
   * Create a new vehicle
   */
  async create(createVehicleDto: CreateVehicleDto, actor?: Actor): Promise<Vehicle> {
    const organizationId = this.requireOrganizationId(actor);
    this.logger.log(
      `Creating new vehicle: ${createVehicleDto.make} ${createVehicleDto.model}`,
    );

    // Check if license plate already exists
    const existing = await this.vehicleRepository.findOne({
      where: { licensePlate: createVehicleDto.licensePlate, organizationId },
    });

    if (existing) {
      throw new ConflictException(
        `Vehicle with license plate ${createVehicleDto.licensePlate} already exists`,
      );
    }

    const vehicle = this.vehicleRepository.create({
      ...createVehicleDto,
      organizationId,
      vehicleType: this.normalizeType(createVehicleDto.vehicleType),
      fuelType: this.normalizeType(createVehicleDto.fuelType),
      capacityWeightKg:
        createVehicleDto.capacityWeightKg ?? createVehicleDto.capacity ?? undefined,
      status: this.normalizeStatus(createVehicleDto.status || 'available'),
    });

    return this.vehicleRepository.save(vehicle);
  }

  /**
   * Find all vehicles
   */
  async findAll(actor?: Actor): Promise<Vehicle[]> {
    this.logger.log('Fetching all vehicles');
    return this.vehicleRepository.find({
      where: this.scopedWhere(actor),
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find one vehicle by ID
   */
  async findOne(id: string, actor?: Actor): Promise<Vehicle> {
    this.logger.log(`Fetching vehicle with ID: ${id}`);

    const vehicle = await this.vehicleRepository.findOne({
      where: this.scopedWhere(actor, { id }),
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${id} not found`);
    }

    return vehicle;
  }

  /**
   * Find vehicles by status
   */
  async findByStatus(status: string, actor?: Actor): Promise<Vehicle[]> {
    this.logger.log(`Fetching vehicles with status: ${status}`);
    return this.vehicleRepository.find({
      where: this.scopedWhere(actor, { status: this.normalizeStatus(status) }),
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update a vehicle
   */
  async update(
    id: string,
    updateVehicleDto: UpdateVehicleDto,
    actor?: Actor,
  ): Promise<Vehicle> {
    const organizationId = this.requireOrganizationId(actor);
    this.logger.log(`Updating vehicle with ID: ${id}`);

    const vehicle = await this.findOne(id, actor);

    // Check license plate uniqueness if being updated
    if (
      updateVehicleDto.licensePlate &&
      updateVehicleDto.licensePlate !== vehicle.licensePlate
    ) {
      const existing = await this.vehicleRepository.findOne({
        where: { licensePlate: updateVehicleDto.licensePlate, organizationId },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Vehicle with license plate ${updateVehicleDto.licensePlate} already exists`,
        );
      }
    }

    const normalizedUpdate = {
      ...updateVehicleDto,
      ...(updateVehicleDto.vehicleType
        ? { vehicleType: this.normalizeType(updateVehicleDto.vehicleType) }
        : {}),
      ...(updateVehicleDto.fuelType
        ? { fuelType: this.normalizeType(updateVehicleDto.fuelType) }
        : {}),
      ...(updateVehicleDto.capacity !== undefined
        ? { capacityWeightKg: updateVehicleDto.capacity }
        : {}),
      ...(updateVehicleDto.status
        ? { status: this.normalizeStatus(updateVehicleDto.status) }
        : {}),
    };

    Object.assign(vehicle, normalizedUpdate);
    return this.vehicleRepository.save(vehicle);
  }

  /**
   * Soft delete a vehicle
   */
  async remove(id: string, actor?: Actor): Promise<void> {
    this.logger.log(`Soft deleting vehicle with ID: ${id}`);

    const vehicle = await this.findOne(id, actor);
    await this.vehicleRepository.softRemove(vehicle);
  }

  /**
   * Get vehicle statistics
   */
  async getStatistics(actor?: Actor): Promise<{
    total: number;
    available: number;
    inUse: number;
    maintenance: number;
  }> {
    const organizationId = this.requireOrganizationId(actor);
    const [total, available, inUse, maintenance] = await Promise.all([
      this.vehicleRepository.count({ where: { organizationId } }),
      this.vehicleRepository.count({ where: { status: 'available', organizationId } }),
      this.vehicleRepository.count({ where: { status: 'in_use', organizationId } }),
      this.vehicleRepository.count({ where: { status: 'maintenance', organizationId } }),
    ]);

    return {
      total,
      available,
      inUse,
      maintenance,
    };
  }

  findByType(vehicleType: string, actor?: Actor) {
    return this.vehicleRepository.find({
      where: this.scopedWhere(actor, { vehicleType }),
    });
  }

  async findNeedingMaintenance(actor?: Actor) {
    const organizationId = this.requireOrganizationId(actor);
    // Find vehicles that need maintenance based on odometer readings
    return this.vehicleRepository
      .createQueryBuilder('vehicle')
      .where('vehicle.organization_id = :organizationId', { organizationId })
      .andWhere('vehicle.next_maintenance_km IS NOT NULL')
      .andWhere('vehicle.current_odometer_km >= vehicle.next_maintenance_km')
      .getMany();
  }

  private normalizeType(value: string): string {
    return value.toLowerCase();
  }

  private normalizeStatus(status: string): string {
    const normalized = status.toLowerCase();
    const map: Record<string, string> = {
      active: 'available',
      in_route: 'in_use',
      off_duty: 'out_of_service',
      inactive: 'out_of_service',
    };
    return map[normalized] || normalized;
  }
}
