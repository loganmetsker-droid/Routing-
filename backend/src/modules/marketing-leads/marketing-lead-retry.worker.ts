import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MarketingLeadsService } from './marketing-leads.service';

@Injectable()
export class MarketingLeadRetryWorker {
  private readonly logger = new Logger(MarketingLeadRetryWorker.name);

  constructor(
    private readonly marketingLeads: MarketingLeadsService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'marketing-lead-notification-retry',
    timeZone: 'UTC',
  })
  async retryDueNotifications() {
    if (this.config.get<string>('ENABLE_SCHEDULER', '0') !== '1') {
      return { attempted: 0, skipped: true };
    }

    const result =
      await this.marketingLeads.retryDueOperatorNotifications();
    if (result.attempted > 0) {
      this.logger.log(
        `Retried ${result.attempted} lead notification(s): ${result.sent} sent, ${result.failed} failed`,
      );
    }
    return result;
  }
}
