import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShiftsService } from './shifts.service';

/**
 * Background worker for automatic shift completion
 * Runs every hour to mark shifts as "completed" if their end_time has passed
 */
@Injectable()
export class ShiftCompletionCron {
  private readonly logger = new Logger(ShiftCompletionCron.name);

  constructor(private readonly shiftsService: ShiftsService) {}

  /**
   * Cron job that runs every hour at minute 0
   * Checks for shifts that have passed their scheduled end time and auto-completes them
   *
   * Schedule: Every hour at :00
   * Example: 00:00, 01:00, 02:00, etc.
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'auto-complete-shifts',
    timeZone: 'UTC',
  })
  async handleShiftCompletion() {
    this.logger.log('Starting automatic shift completion check');

    try {
      const completedCount =
        await this.shiftsService.autoCompleteExpiredShifts();

      if (completedCount > 0) {
        this.logger.log(
          `✅ Auto-completed ${completedCount} expired shift(s)`,
        );
      } else {
        this.logger.debug('No expired shifts to complete');
      }
    } catch (error) {
      this.logger.error(
        `❌ Error during shift auto-completion: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Optional: Additional cron job that runs every 30 minutes
   * Uncomment if you want more frequent checks
   */
  // @Cron('0 */30 * * * *', {
  //   name: 'auto-complete-shifts-frequent',
  //   timeZone: 'UTC',
  // })
  // async handleFrequentShiftCompletion() {
  //   this.logger.log('Starting frequent shift completion check (30 min)');
  //   await this.handleShiftCompletion();
  // }

  /**
   * Manual trigger for testing purposes
   * Can be called from a controller endpoint if needed
   */
  async manualTrigger(): Promise<number> {
    this.logger.log('Manual trigger of shift completion');
    return await this.shiftsService.autoCompleteExpiredShifts();
  }
}
