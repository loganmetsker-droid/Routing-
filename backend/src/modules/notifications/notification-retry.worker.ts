import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationRetryWorker {
  private readonly logger = new Logger(NotificationRetryWorker.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'notification-delivery-retry',
    timeZone: 'UTC',
  })
  async retryDueDeliveries() {
    if (
      this.configService.get<string>('ENABLE_SCHEDULER', '0') !== '1'
    ) {
      return { attempted: 0, skipped: true };
    }

    const result = await this.notificationsService.retryDueDeliveries();
    if (result.attempted > 0) {
      this.logger.log(
        `Retried ${result.attempted} notification delivery record(s): ${result.sent} sent, ${result.failed} failed`,
      );
    }
    return result;
  }
}
