import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Shift } from '../drivers/entities/shift.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { CreateShiftDto } from '../drivers/dto/create-shift.dto';

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {}

  /**
   * Create a new shift with automatic status = "scheduled"
   */
  async create(createShiftDto: CreateShiftDto): Promise<Shift> {
    this.logger.log(`Creating new shift for driver: ${createShiftDto.driverId}`);

    // Validate driver exists
    const driver = await this.driverRepository.findOne({
      where: { id: createShiftDto.driverId },
    });

    if (!driver) {
      throw new NotFoundException(
        `Driver with ID ${createShiftDto.driverId} not found`,
      );
    }

    // Validate vehicle exists if provided
    if (createShiftDto.vehicleId) {
      const vehicle = await this.vehicleRepository.findOne({
        where: { id: createShiftDto.vehicleId },
      });

      if (!vehicle) {
        throw new NotFoundException(
          `Vehicle with ID ${createShiftDto.vehicleId} not found`,
        );
      }
    }

    // Validate scheduled times
    const scheduledStart = new Date(createShiftDto.scheduledStart);
    const scheduledEnd = new Date(createShiftDto.scheduledEnd);

    if (scheduledEnd <= scheduledStart) {
      throw new BadRequestException(
        'Scheduled end time must be after scheduled start time',
      );
    }

    // Check for overlapping shifts for the same driver
    const overlappingShift = await this.shiftRepository
      .createQueryBuilder('shift')
      .where('shift.driver_id = :driverId', {
        driverId: createShiftDto.driverId,
      })
      .andWhere('shift.status NOT IN (:...statuses)', {
        statuses: ['completed', 'cancelled'],
      })
      .andWhere(
        '(shift.scheduled_start < :end AND shift.scheduled_end > :start)',
        {
          start: scheduledStart,
          end: scheduledEnd,
        },
      )
      .getOne();

    if (overlappingShift) {
      throw new ConflictException(
        `Driver already has a shift scheduled during this time period`,
      );
    }

    // Create shift with automatic "scheduled" status
    const shift = this.shiftRepository.create({
      ...createShiftDto,
      status: 'scheduled', // Automatically set to "scheduled"
      shiftType: createShiftDto.shiftType || 'regular',
      totalBreakMinutes: 0,
      deliveriesCompleted: 0,
    });

    const saved = await this.shiftRepository.save(shift);
    this.logger.log(`Shift created successfully with ID: ${saved.id}`);
    return saved;
  }

  /**
   * Find all shifts
   */
  async findAll(): Promise<Shift[]> {
    this.logger.log('Fetching all shifts');
    return this.shiftRepository.find({
      relations: ['driver', 'vehicle'],
      order: { shiftDate: 'DESC', scheduledStart: 'DESC' },
    });
  }

  /**
   * Find one shift by ID
   */
  async findOne(id: string): Promise<Shift> {
    this.logger.log(`Fetching shift with ID: ${id}`);

    const shift = await this.shiftRepository.findOne({
      where: { id },
      relations: ['driver', 'vehicle'],
    });

    if (!shift) {
      throw new NotFoundException(`Shift with ID ${id} not found`);
    }

    return shift;
  }

  /**
   * Find shifts by status
   */
  async findByStatus(status: string): Promise<Shift[]> {
    this.logger.log(`Fetching shifts with status: ${status}`);
    return this.shiftRepository.find({
      where: { status },
      relations: ['driver', 'vehicle'],
      order: { shiftDate: 'DESC', scheduledStart: 'DESC' },
    });
  }

  /**
   * Find shifts for a specific date
   */
  async findByDate(date: string): Promise<Shift[]> {
    this.logger.log(`Fetching shifts for date: ${date}`);
    return this.shiftRepository.find({
      where: { shiftDate: new Date(date) },
      relations: ['driver', 'vehicle'],
      order: { scheduledStart: 'ASC' },
    });
  }

  /**
   * Start a shift (set actual_start and change status to in_progress)
   */
  async startShift(id: string): Promise<Shift> {
    this.logger.log(`Starting shift: ${id}`);

    const shift = await this.findOne(id);

    if (shift.status !== 'scheduled') {
      throw new BadRequestException(
        `Shift cannot be started. Current status: ${shift.status}`,
      );
    }

    shift.actualStart = new Date();
    shift.status = 'in_progress';

    const updated = await this.shiftRepository.save(shift);
    this.logger.log(`Shift started: ${id}`);
    return updated;
  }

  /**
   * End a shift (set actual_end and change status to completed)
   */
  async endShift(id: string): Promise<Shift> {
    this.logger.log(`Ending shift: ${id}`);

    const shift = await this.findOne(id);

    if (shift.status !== 'in_progress') {
      throw new BadRequestException(
        `Shift cannot be ended. Current status: ${shift.status}`,
      );
    }

    if (!shift.actualStart) {
      throw new BadRequestException('Shift has not been started yet');
    }

    shift.actualEnd = new Date();
    shift.status = 'completed';

    const updated = await this.shiftRepository.save(shift);
    this.logger.log(`Shift ended: ${id}`);
    return updated;
  }

  /**
   * Auto-complete shifts that have passed their scheduled end time
   * This is called by the cron job
   */
  async autoCompleteExpiredShifts(): Promise<number> {
    this.logger.log('Running auto-completion for expired shifts');

    const now = new Date();

    // Find shifts that should be completed
    const expiredShifts = await this.shiftRepository.find({
      where: {
        scheduledEnd: LessThan(now),
        status: 'in_progress',
      },
    });

    if (expiredShifts.length === 0) {
      this.logger.log('No expired shifts found');
      return 0;
    }

    this.logger.log(`Found ${expiredShifts.length} expired shifts to complete`);

    // Update all expired shifts
    for (const shift of expiredShifts) {
      shift.status = 'completed';
      if (!shift.actualEnd) {
        shift.actualEnd = shift.scheduledEnd; // Use scheduled end if actual end not set
      }
      await this.shiftRepository.save(shift);
    }

    this.logger.log(`Auto-completed ${expiredShifts.length} shifts`);
    return expiredShifts.length;
  }

  /**
   * Get shift statistics
   */
  async getStatistics(): Promise<{
    total: number;
    scheduled: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    noShow: number;
  }> {
    const [total, scheduled, inProgress, completed, cancelled, noShow] =
      await Promise.all([
        this.shiftRepository.count(),
        this.shiftRepository.count({ where: { status: 'scheduled' } }),
        this.shiftRepository.count({ where: { status: 'in_progress' } }),
        this.shiftRepository.count({ where: { status: 'completed' } }),
        this.shiftRepository.count({ where: { status: 'cancelled' } }),
        this.shiftRepository.count({ where: { status: 'no_show' } }),
      ]);

    return {
      total,
      scheduled,
      inProgress,
      completed,
      cancelled,
      noShow,
    };
  }

  /**
   * Get active shifts (scheduled or in progress)
   */
  async getActiveShifts(): Promise<Shift[]> {
    this.logger.log('Fetching active shifts');
    return this.shiftRepository.find({
      where: [{ status: 'scheduled' }, { status: 'in_progress' }],
      relations: ['driver', 'vehicle'],
      order: { scheduledStart: 'ASC' },
    });
  }

  /**
   * Cancel a shift
   */
  async cancelShift(id: string, reason?: string): Promise<Shift> {
    this.logger.log(`Cancelling shift: ${id}`);

    const shift = await this.findOne(id);

    if (shift.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed shift');
    }

    shift.status = 'cancelled';
    if (reason) {
      shift.notes = shift.notes
        ? `${shift.notes}\n\nCancellation reason: ${reason}`
        : `Cancellation reason: ${reason}`;
    }

    const updated = await this.shiftRepository.save(shift);
    this.logger.log(`Shift cancelled: ${id}`);
    return updated;
  }
}
