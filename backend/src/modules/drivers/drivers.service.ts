import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Driver } from './entities/driver.entity';
import { Shift } from './entities/shift.entity';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { Vehicle } from '../vehicles/entities/vehicle.entity';

type Actor = {
  organizationId?: string;
};

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
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
    where: FindOptionsWhere<Driver> = {},
  ): FindOptionsWhere<Driver> {
    return {
      ...where,
      organizationId: this.requireOrganizationId(actor),
    };
  }

  private async assertVehicleInOrganization(
    vehicleId: string | null | undefined,
    organizationId: string,
  ) {
    if (!vehicleId) {
      return;
    }
    const vehicle = await this.vehicleRepository.findOne({
      where: { id: vehicleId, organizationId },
    });
    if (!vehicle) {
      throw new BadRequestException(`Vehicle with ID ${vehicleId} not found`);
    }
  }

  async create(createDriverDto: CreateDriverDto, actor?: Actor): Promise<Driver> {
    const organizationId = this.requireOrganizationId(actor);
    this.logger.log(
      `Creating new driver: ${createDriverDto.firstName} ${createDriverDto.lastName}`,
    );

    const existingEmail = await this.driverRepository.findOne({
      where: { email: createDriverDto.email, organizationId },
    });

    if (existingEmail) {
      throw new ConflictException(
        `Driver with email ${createDriverDto.email} already exists`,
      );
    }

    const existingLicense = await this.driverRepository.findOne({
      where: { licenseNumber: createDriverDto.licenseNumber, organizationId },
    });

    if (existingLicense) {
      throw new ConflictException(
        `Driver with license number ${createDriverDto.licenseNumber} already exists`,
      );
    }

    if (createDriverDto.employeeId) {
      const existingEmployee = await this.driverRepository.findOne({
        where: { employeeId: createDriverDto.employeeId, organizationId },
      });

      if (existingEmployee) {
        throw new ConflictException(
          `Driver with employee ID ${createDriverDto.employeeId} already exists`,
        );
      }
    }

    const fallbackExpiry = new Date();
    fallbackExpiry.setFullYear(fallbackExpiry.getFullYear() + 1);
    const normalizedLicenseExpiryDate =
      createDriverDto.licenseExpiryDate || fallbackExpiry.toISOString().slice(0, 10);

    const expiryDate = new Date(normalizedLicenseExpiryDate);
    if (!Number.isNaN(expiryDate.getTime()) && expiryDate <= new Date()) {
      throw new BadRequestException('License expiry date must be in the future');
    }

    const normalizedStatus = this.normalizeStatus(createDriverDto.status || 'off_duty');
    const currentVehicleId =
      createDriverDto.currentVehicleId || createDriverDto.assignedVehicleId || undefined;
    await this.assertVehicleInOrganization(currentVehicleId, organizationId);

    const driver = this.driverRepository.create({
      ...createDriverDto,
      organizationId,
      licenseClass: createDriverDto.licenseClass || createDriverDto.licenseType || undefined,
      licenseExpiryDate: normalizedLicenseExpiryDate as any,
      currentVehicleId,
      status: normalizedStatus,
      employmentStatus: createDriverDto.employmentStatus || 'active',
      totalHoursDriven: 0,
      totalDistanceKm: 0,
      totalDeliveries: 0,
      certifications: createDriverDto.certifications || [],
      metadata: {
        ...(createDriverDto.metadata || {}),
        ...(createDriverDto.notes ? { notes: createDriverDto.notes } : {}),
      },
    });

    const saved = await this.driverRepository.save(driver);
    this.logger.log(`Driver created successfully with ID: ${saved.id}`);
    return saved;
  }

  async findAll(actor?: Actor): Promise<Driver[]> {
    this.logger.log('Fetching all drivers');
    return this.driverRepository.find({
      where: this.scopedWhere(actor),
      relations: ['currentVehicle'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, actor?: Actor): Promise<Driver> {
    this.logger.log(`Fetching driver with ID: ${id}`);

    const driver = await this.driverRepository.findOne({
      where: this.scopedWhere(actor, { id }),
      relations: ['currentVehicle'],
    });

    if (!driver) {
      throw new NotFoundException(`Driver with ID ${id} not found`);
    }

    return driver;
  }

  async findByStatus(status: string, actor?: Actor): Promise<Driver[]> {
    this.logger.log(`Fetching drivers with status: ${status}`);
    return this.driverRepository.find({
      where: this.scopedWhere(actor, { status: this.normalizeStatus(status) }),
      relations: ['currentVehicle'],
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findByEmploymentStatus(
    employmentStatus: string,
    actor?: Actor,
  ): Promise<Driver[]> {
    this.logger.log(
      `Fetching drivers with employment status: ${employmentStatus}`,
    );
    return this.driverRepository.find({
      where: this.scopedWhere(actor, { employmentStatus }),
      relations: ['currentVehicle'],
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findWithExpiringLicenses(
    daysThreshold: number = 30,
    actor?: Actor,
  ): Promise<Driver[]> {
    this.logger.log(
      `Fetching drivers with licenses expiring in ${daysThreshold} days`,
    );
    const organizationId = this.requireOrganizationId(actor);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysThreshold);

    return this.driverRepository
      .createQueryBuilder('driver')
      .where('driver.organization_id = :organizationId', { organizationId })
      .andWhere('driver.license_expiry_date <= :futureDate', { futureDate })
      .andWhere('driver.license_expiry_date > :now', { now: new Date() })
      .orderBy('driver.license_expiry_date', 'ASC')
      .getMany();
  }

  async getDriverShifts(driverId: string, actor?: Actor): Promise<Shift[]> {
    this.logger.log(`Fetching shifts for driver: ${driverId}`);
    await this.findOne(driverId, actor);

    return this.shiftRepository.find({
      where: { driverId },
      relations: ['vehicle', 'driver'],
      order: { shiftDate: 'DESC', scheduledStart: 'DESC' },
    });
  }

  async getRecentShifts(
    driverId: string,
    limit: number = 10,
    actor?: Actor,
  ): Promise<Shift[]> {
    this.logger.log(`Fetching ${limit} recent shifts for driver: ${driverId}`);
    await this.findOne(driverId, actor);

    return this.shiftRepository.find({
      where: { driverId },
      relations: ['vehicle'],
      order: { shiftDate: 'DESC', scheduledStart: 'DESC' },
      take: limit,
    });
  }

  async getCurrentShift(driverId: string, actor?: Actor): Promise<Shift | null> {
    this.logger.log(`Fetching current shift for driver: ${driverId}`);
    await this.findOne(driverId, actor);

    return this.shiftRepository.findOne({
      where: { driverId, status: 'in_progress' },
      relations: ['vehicle'],
    });
  }

  async update(
    id: string,
    updateDriverDto: UpdateDriverDto,
    actor?: Actor,
  ): Promise<Driver> {
    const organizationId = this.requireOrganizationId(actor);
    this.logger.log(`Updating driver with ID: ${id}`);

    const driver = await this.findOne(id, actor);

    if (updateDriverDto.email && updateDriverDto.email !== driver.email) {
      const existing = await this.driverRepository.findOne({
        where: { email: updateDriverDto.email, organizationId },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Driver with email ${updateDriverDto.email} already exists`,
        );
      }
    }

    if (
      updateDriverDto.licenseNumber &&
      updateDriverDto.licenseNumber !== driver.licenseNumber
    ) {
      const existing = await this.driverRepository.findOne({
        where: { licenseNumber: updateDriverDto.licenseNumber, organizationId },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Driver with license number ${updateDriverDto.licenseNumber} already exists`,
        );
      }
    }

    if (
      updateDriverDto.employeeId &&
      updateDriverDto.employeeId !== driver.employeeId
    ) {
      const existing = await this.driverRepository.findOne({
        where: { employeeId: updateDriverDto.employeeId, organizationId },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Driver with employee ID ${updateDriverDto.employeeId} already exists`,
        );
      }
    }

    if (updateDriverDto.licenseExpiryDate) {
      const expiryDate = new Date(updateDriverDto.licenseExpiryDate);
      if (!Number.isNaN(expiryDate.getTime()) && expiryDate <= new Date()) {
        throw new BadRequestException('License expiry date must be in the future');
      }
    }

    const nextVehicleId =
      updateDriverDto.currentVehicleId || updateDriverDto.assignedVehicleId;
    await this.assertVehicleInOrganization(nextVehicleId, organizationId);

    const normalizedUpdate = {
      ...updateDriverDto,
      ...(updateDriverDto.status ? { status: this.normalizeStatus(updateDriverDto.status) } : {}),
      ...(updateDriverDto.licenseType ? { licenseClass: updateDriverDto.licenseType } : {}),
      ...(updateDriverDto.assignedVehicleId !== undefined
        ? { currentVehicleId: updateDriverDto.assignedVehicleId || null }
        : {}),
      ...(updateDriverDto.notes
        ? {
            metadata: {
              ...(driver.metadata || {}),
              notes: updateDriverDto.notes,
            },
          }
        : {}),
    };

    Object.assign(driver, normalizedUpdate);
    const updated = await this.driverRepository.save(driver);
    this.logger.log(`Driver updated successfully: ${id}`);
    return updated;
  }

  async remove(id: string, actor?: Actor): Promise<void> {
    this.logger.log(`Soft deleting driver with ID: ${id}`);

    const driver = await this.findOne(id, actor);
    await this.driverRepository.softRemove(driver);
    this.logger.log(`Driver soft deleted: ${id}`);
  }

  async getStatistics(actor?: Actor): Promise<{
    total: number;
    active: number;
    available: number;
    onRoute: number;
    onBreak: number;
    offDuty: number;
    byEmploymentStatus: Record<string, number>;
  }> {
    const organizationId = this.requireOrganizationId(actor);
    const [total, active, available, onRoute, onBreak, offDuty] =
      await Promise.all([
        this.driverRepository.count({ where: { organizationId } }),
        this.driverRepository.count({
          where: { employmentStatus: 'active', organizationId },
        }),
        this.driverRepository.count({ where: { status: 'available', organizationId } }),
        this.driverRepository.count({ where: { status: 'on_route', organizationId } }),
        this.driverRepository.count({ where: { status: 'on_break', organizationId } }),
        this.driverRepository.count({ where: { status: 'off_duty', organizationId } }),
      ]);

    const employmentQuery = await this.driverRepository
      .createQueryBuilder('driver')
      .select('driver.employment_status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('driver.organization_id = :organizationId', { organizationId })
      .groupBy('driver.employment_status')
      .getRawMany();

    const byEmploymentStatus = employmentQuery.reduce((acc, { status, count }) => {
      acc[status] = parseInt(count, 10);
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      active,
      available,
      onRoute,
      onBreak,
      offDuty,
      byEmploymentStatus,
    };
  }

  private normalizeStatus(status: string): string {
    const normalized = status.toLowerCase();
    const map: Record<string, string> = {
      active: 'available',
      inactive: 'off_duty',
      unavailable: 'off_duty',
    };
    return map[normalized] || normalized;
  }
}
