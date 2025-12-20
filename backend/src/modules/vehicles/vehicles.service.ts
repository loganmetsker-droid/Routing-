import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {}

  /**
   * Create a new vehicle
   */
  async create(createVehicleDto: CreateVehicleDto): Promise<Vehicle> {
    this.logger.log(
      `Creating new vehicle: ${createVehicleDto.make} ${createVehicleDto.model}`,
    );

    // Check if license plate already exists
    const existing = await this.vehicleRepository.findOne({
      where: { licensePlate: createVehicleDto.licensePlate },
    });

    if (existing) {
      throw new ConflictException(
        `Vehicle with license plate ${createVehicleDto.licensePlate} already exists`,
      );
    }

    const vehicle = this.vehicleRepository.create({
      ...createVehicleDto,
      status: 'available',
    });

    return this.vehicleRepository.save(vehicle);
  }

  /**
   * Find all vehicles
   */
  async findAll(): Promise<Vehicle[]> {
    this.logger.log('Fetching all vehicles');
    return this.vehicleRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find one vehicle by ID
   */
  async findOne(id: string): Promise<Vehicle> {
    this.logger.log(`Fetching vehicle with ID: ${id}`);

    const vehicle = await this.vehicleRepository.findOne({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${id} not found`);
    }

    return vehicle;
  }

  /**
   * Find vehicles by status
   */
  async findByStatus(status: string): Promise<Vehicle[]> {
    this.logger.log(`Fetching vehicles with status: ${status}`);
    return this.vehicleRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update a vehicle
   */
  async update(
    id: string,
    updateVehicleDto: UpdateVehicleDto,
  ): Promise<Vehicle> {
    this.logger.log(`Updating vehicle with ID: ${id}`);

    const vehicle = await this.findOne(id);

    // Check license plate uniqueness if being updated
    if (
      updateVehicleDto.licensePlate &&
      updateVehicleDto.licensePlate !== vehicle.licensePlate
    ) {
      const existing = await this.vehicleRepository.findOne({
        where: { licensePlate: updateVehicleDto.licensePlate },
      });

      if (existing) {
        throw new ConflictException(
          `Vehicle with license plate ${updateVehicleDto.licensePlate} already exists`,
        );
      }
    }

    Object.assign(vehicle, updateVehicleDto);
    return this.vehicleRepository.save(vehicle);
  }

  /**
   * Soft delete a vehicle
   */
  async remove(id: string): Promise<void> {
    this.logger.log(`Soft deleting vehicle with ID: ${id}`);

    const vehicle = await this.findOne(id);
    await this.vehicleRepository.softRemove(vehicle);
  }

  /**
   * Get vehicle statistics
   */
  async getStatistics(): Promise<{
    total: number;
    available: number;
    inUse: number;
    maintenance: number;
  }> {
    const [total, available, inUse, maintenance] = await Promise.all([
      this.vehicleRepository.count(),
      this.vehicleRepository.count({ where: { status: 'available' } }),
      this.vehicleRepository.count({ where: { status: 'in_use' } }),
      this.vehicleRepository.count({ where: { status: 'maintenance' } }),
    ]);

    return {
      total,
      available,
      inUse,
      maintenance,
    };
  }

  findByType(vehicleType: string) {
    return this.vehicleRepository.find({ where: { vehicleType } });
  }

  async findNeedingMaintenance() {
    // Find vehicles that need maintenance based on odometer readings
    return this.vehicleRepository
      .createQueryBuilder('vehicle')
      .where('vehicle.next_maintenance_km IS NOT NULL')
      .andWhere('vehicle.current_odometer_km >= vehicle.next_maintenance_km')
      .getMany();
  }
}

