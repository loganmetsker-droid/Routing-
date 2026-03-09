import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from './entities/driver.entity';
import { Shift } from './entities/shift.entity';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
  ) {}

  async create(createDriverDto: CreateDriverDto): Promise<Driver> {
    this.logger.log(
      `Creating new driver: ${createDriverDto.firstName} ${createDriverDto.lastName}`,
    );

    const existingEmail = await this.driverRepository.findOne({
      where: { email: createDriverDto.email },
    });

    if (existingEmail) {
      throw new ConflictException(
        `Driver with email ${createDriverDto.email} already exists`,
      );
    }

    const existingLicense = await this.driverRepository.findOne({
      where: { licenseNumber: createDriverDto.licenseNumber },
    });

    if (existingLicense) {
      throw new ConflictException(
        `Driver with license number ${createDriverDto.licenseNumber} already exists`,
      );
    }

    if (createDriverDto.employeeId) {
      const existingEmployee = await this.driverRepository.findOne({
        where: { employeeId: createDriverDto.employeeId },
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

    const driver = this.driverRepository.create({
      ...createDriverDto,
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

  async findAll(): Promise<Driver[]> {
    this.logger.log('Fetching all drivers');
    return this.driverRepository.find({
      relations: ['currentVehicle'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Driver> {
    this.logger.log(`Fetching driver with ID: ${id}`);

    const driver = await this.driverRepository.findOne({
      where: { id },
      relations: ['currentVehicle'],
    });

    if (!driver) {
      throw new NotFoundException(`Driver with ID ${id} not found`);
    }

    return driver;
  }

  async findByStatus(status: string): Promise<Driver[]> {
    this.logger.log(`Fetching drivers with status: ${status}`);
    return this.driverRepository.find({
      where: { status: this.normalizeStatus(status) },
      relations: ['currentVehicle'],
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findByEmploymentStatus(employmentStatus: string): Promise<Driver[]> {
    this.logger.log(
      `Fetching drivers with employment status: ${employmentStatus}`,
    );
    return this.driverRepository.find({
      where: { employmentStatus },
      relations: ['currentVehicle'],
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findWithExpiringLicenses(daysThreshold: number = 30): Promise<Driver[]> {
    this.logger.log(
      `Fetching drivers with licenses expiring in ${daysThreshold} days`,
    );

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysThreshold);

    return this.driverRepository
      .createQueryBuilder('driver')
      .where('driver.license_expiry_date <= :futureDate', { futureDate })
      .andWhere('driver.license_expiry_date > :now', { now: new Date() })
      .orderBy('driver.license_expiry_date', 'ASC')
      .getMany();
  }

  async getDriverShifts(driverId: string): Promise<Shift[]> {
    this.logger.log(`Fetching shifts for driver: ${driverId}`);
    await this.findOne(driverId);

    return this.shiftRepository.find({
      where: { driverId },
      relations: ['vehicle', 'driver'],
      order: { shiftDate: 'DESC', scheduledStart: 'DESC' },
    });
  }

  async getRecentShifts(driverId: string, limit: number = 10): Promise<Shift[]> {
    this.logger.log(`Fetching ${limit} recent shifts for driver: ${driverId}`);
    await this.findOne(driverId);

    return this.shiftRepository.find({
      where: { driverId },
      relations: ['vehicle'],
      order: { shiftDate: 'DESC', scheduledStart: 'DESC' },
      take: limit,
    });
  }

  async getCurrentShift(driverId: string): Promise<Shift | null> {
    this.logger.log(`Fetching current shift for driver: ${driverId}`);
    await this.findOne(driverId);

    return this.shiftRepository.findOne({
      where: { driverId, status: 'in_progress' },
      relations: ['vehicle'],
    });
  }

  async update(id: string, updateDriverDto: UpdateDriverDto): Promise<Driver> {
    this.logger.log(`Updating driver with ID: ${id}`);

    const driver = await this.findOne(id);

    if (updateDriverDto.email && updateDriverDto.email !== driver.email) {
      const existing = await this.driverRepository.findOne({
        where: { email: updateDriverDto.email },
      });

      if (existing) {
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
        where: { licenseNumber: updateDriverDto.licenseNumber },
      });

      if (existing) {
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
        where: { employeeId: updateDriverDto.employeeId },
      });

      if (existing) {
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

    const normalizedUpdate = {
      ...updateDriverDto,
      ...(updateDriverDto.status ? { status: this.normalizeStatus(updateDriverDto.status) } : {}),
      ...(updateDriverDto.licenseType ? { licenseClass: updateDriverDto.licenseType } : {}),
      ...(updateDriverDto.assignedVehicleId
        ? { currentVehicleId: updateDriverDto.assignedVehicleId }
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

  async remove(id: string): Promise<void> {
    this.logger.log(`Soft deleting driver with ID: ${id}`);

    const driver = await this.findOne(id);
    await this.driverRepository.softRemove(driver);
    this.logger.log(`Driver soft deleted: ${id}`);
  }

  async getStatistics(): Promise<{
    total: number;
    active: number;
    available: number;
    onRoute: number;
    onBreak: number;
    offDuty: number;
    byEmploymentStatus: Record<string, number>;
  }> {
    const [total, active, available, onRoute, onBreak, offDuty] =
      await Promise.all([
        this.driverRepository.count(),
        this.driverRepository.count({
          where: { employmentStatus: 'active' },
        }),
        this.driverRepository.count({ where: { status: 'available' } }),
        this.driverRepository.count({ where: { status: 'on_route' } }),
        this.driverRepository.count({ where: { status: 'on_break' } }),
        this.driverRepository.count({ where: { status: 'off_duty' } }),
      ]);

    const employmentQuery = await this.driverRepository
      .createQueryBuilder('driver')
      .select('driver.employment_status', 'status')
      .addSelect('COUNT(*)', 'count')
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
