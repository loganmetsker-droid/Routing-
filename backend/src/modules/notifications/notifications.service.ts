import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { Job } from '../jobs/entities/job.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Organization } from '../organizations/entities/organization.entity';

type NotificationEventType =
  | 'assignment'
  | 'en_route'
  | 'arriving_soon'
  | 'delivered'
  | 'failed_delivery'
  | 'exception'
  | 'eta_updated';

type NotifyCustomerInput = {
  organizationId?: string | null;
  routeId?: string | null;
  routeRunStopId?: string | null;
  jobId?: string | null;
  customerId?: string | null;
  eventType: NotificationEventType;
  trackingUrl?: string | null;
  eta?: string | null;
  reason?: string | null;
};

type NotificationConfig = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  replyToEmail?: string | null;
};

type BrandingConfig = {
  brandName?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveries: Repository<NotificationDelivery>,
    @InjectRepository(Job)
    private readonly jobs: Repository<Job>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    private readonly configService: ConfigService,
  ) {}

  private getEmailProvider() {
    return this.configService.get<string>('POSTMARK_SERVER_TOKEN')
      ? 'postmark'
      : 'disabled';
  }

  private getSmsProvider() {
    return this.configService.get<string>('TWILIO_ACCOUNT_SID') &&
      this.configService.get<string>('TWILIO_AUTH_TOKEN') &&
      this.configService.get<string>('TWILIO_FROM_NUMBER')
      ? 'twilio'
      : 'disabled';
  }

  private getOrganizationBranding(
    organization?: Organization | null,
  ): BrandingConfig {
    const settings =
      organization?.settings &&
      typeof organization.settings === 'object' &&
      !Array.isArray(organization.settings)
        ? organization.settings
        : {};
    const branding =
      settings &&
      typeof (settings as Record<string, unknown>).branding === 'object' &&
      (settings as Record<string, unknown>).branding !== null &&
      !Array.isArray((settings as Record<string, unknown>).branding)
        ? ((settings as Record<string, unknown>).branding as Record<string, unknown>)
        : {};

    return {
      brandName:
        typeof branding.brandName === 'string' ? branding.brandName : null,
      supportEmail:
        typeof branding.supportEmail === 'string' ? branding.supportEmail : null,
      supportPhone:
        typeof branding.supportPhone === 'string' ? branding.supportPhone : null,
    };
  }

  private getNotificationConfig(
    organization?: Organization | null,
  ): NotificationConfig {
    const settings =
      organization?.settings &&
      typeof organization.settings === 'object' &&
      !Array.isArray(organization.settings)
        ? organization.settings
        : {};
    const notifications =
      settings &&
      typeof (settings as Record<string, unknown>).notifications === 'object' &&
      (settings as Record<string, unknown>).notifications !== null &&
      !Array.isArray((settings as Record<string, unknown>).notifications)
        ? ((settings as Record<string, unknown>).notifications as Record<string, unknown>)
        : {};

    return {
      emailEnabled:
        typeof notifications.emailEnabled === 'boolean'
          ? notifications.emailEnabled
          : true,
      smsEnabled:
        typeof notifications.smsEnabled === 'boolean'
          ? notifications.smsEnabled
          : true,
      replyToEmail:
        typeof notifications.replyToEmail === 'string'
          ? notifications.replyToEmail
          : null,
    };
  }

  private buildMessage(
    eventType: NotificationEventType,
    brandName: string,
    trackingUrl?: string | null,
    eta?: string | null,
    reason?: string | null,
  ) {
    const trackingLine = trackingUrl ? ` Track it here: ${trackingUrl}` : '';
    const etaLine = eta ? ` Updated ETA: ${eta}.` : '';
    switch (eventType) {
      case 'assignment':
        return {
          subject: `${brandName}: delivery scheduled`,
          message: `Your ${brandName} delivery has been scheduled.${etaLine}${trackingLine}`,
        };
      case 'en_route':
        return {
          subject: `${brandName}: driver en route`,
          message: `Your ${brandName} driver is on the way.${etaLine}${trackingLine}`,
        };
      case 'arriving_soon':
        return {
          subject: `${brandName}: arriving now`,
          message: `Your ${brandName} driver is arriving now.${trackingLine}`,
        };
      case 'delivered':
        return {
          subject: `${brandName}: delivery completed`,
          message: `Your ${brandName} delivery is complete.${trackingLine}`,
        };
      case 'failed_delivery':
        return {
          subject: `${brandName}: delivery needs attention`,
          message: `We could not complete your ${brandName} delivery.${reason ? ` Reason: ${reason}.` : ''}${trackingLine}`,
        };
      case 'exception':
        return {
          subject: `${brandName}: delivery exception`,
          message: `Your ${brandName} delivery needs attention.${reason ? ` ${reason}.` : ''}${trackingLine}`,
        };
      case 'eta_updated':
      default:
        return {
          subject: `${brandName}: delivery update`,
          message: `Your ${brandName} delivery has an update.${etaLine}${trackingLine}`,
        };
    }
  }

  private async deliverEmail(
    recipient: string,
    subject: string,
    message: string,
    branding: BrandingConfig,
    config: NotificationConfig,
  ) {
    const token = this.configService.get<string>('POSTMARK_SERVER_TOKEN');
    const fromAddress =
      this.configService.get<string>('POSTMARK_FROM_EMAIL') ||
      this.configService.get<string>('NOTIFICATION_FROM_EMAIL');

    if (!token || !fromAddress) {
      return {
        provider: 'disabled',
        status: 'SKIPPED' as const,
        failureReason: 'Email provider is not configured',
      };
    }

    try {
      const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-postmark-server-token': token,
        },
        body: JSON.stringify({
          From: fromAddress,
          To: recipient,
          Subject: subject,
          TextBody: message,
          ReplyTo: config.replyToEmail || branding.supportEmail || undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!response.ok) {
        return {
          provider: 'postmark',
          status: 'FAILED' as const,
          failureReason:
            typeof payload.Message === 'string'
              ? payload.Message
              : `Postmark returned ${response.status}`,
        };
      }
      return {
        provider: 'postmark',
        status: 'SENT' as const,
        providerMessageId:
          typeof payload.MessageID === 'string' ? payload.MessageID : null,
      };
    } catch (error) {
      return {
        provider: 'postmark',
        status: 'FAILED' as const,
        failureReason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async deliverSms(recipient: string, message: string) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = this.configService.get<string>('TWILIO_FROM_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      return {
        provider: 'disabled',
        status: 'SKIPPED' as const,
        failureReason: 'SMS provider is not configured',
      };
    }

    try {
      const body = new URLSearchParams({
        To: recipient,
        From: fromNumber,
        Body: message,
      });
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            authorization: `Basic ${Buffer.from(
              `${accountSid}:${authToken}`,
            ).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body,
        },
      );
      const payload = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!response.ok) {
        return {
          provider: 'twilio',
          status: 'FAILED' as const,
          failureReason:
            typeof payload.message === 'string'
              ? payload.message
              : `Twilio returned ${response.status}`,
        };
      }
      return {
        provider: 'twilio',
        status: 'SENT' as const,
        providerMessageId:
          typeof payload.sid === 'string' ? payload.sid : null,
      };
    } catch (error) {
      return {
        provider: 'twilio',
        status: 'FAILED' as const,
        failureReason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getOverview(organizationId?: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [sent24h, failed24h, recent] = await Promise.all([
      this.deliveries.count({
        where: {
          ...(organizationId ? { organizationId } : {}),
          status: 'SENT',
          createdAt: MoreThan(since),
        },
      }),
      this.deliveries.count({
        where: {
          ...(organizationId ? { organizationId } : {}),
          status: 'FAILED',
          createdAt: MoreThan(since),
        },
      }),
      this.deliveries.find({
        where: organizationId ? { organizationId } : {},
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      emailProvider: this.getEmailProvider(),
      smsProvider: this.getSmsProvider(),
      sentLast24Hours: sent24h,
      failedLast24Hours: failed24h,
      recentDeliveries: recent,
      controls: {
        emailReady:
          this.getEmailProvider() !== 'disabled' &&
          Boolean(
            this.configService.get('POSTMARK_FROM_EMAIL') ||
              this.configService.get('NOTIFICATION_FROM_EMAIL'),
          ),
        smsReady: this.getSmsProvider() !== 'disabled',
      },
    };
  }

  async list(organizationId?: string, routeId?: string) {
    return this.deliveries.find({
      where: {
        ...(organizationId ? { organizationId } : {}),
        ...(routeId ? { routeId } : {}),
      },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async notifyCustomer(input: NotifyCustomerInput) {
    const [job, organization] = await Promise.all([
      input.jobId ? this.jobs.findOne({ where: { id: input.jobId } }) : null,
      input.organizationId
        ? this.organizations.findOne({ where: { id: input.organizationId } })
        : null,
    ]);
    const customer = input.customerId
      ? await this.customers.findOne({ where: { id: input.customerId } })
      : job?.customerId
        ? await this.customers.findOne({ where: { id: job.customerId } })
        : null;

    const branding = this.getOrganizationBranding(organization);
    const notificationConfig = this.getNotificationConfig(organization);
    const brandName = branding.brandName || organization?.name || 'Trovan';
    const composed = this.buildMessage(
      input.eventType,
      brandName,
      input.trackingUrl,
      input.eta,
      input.reason,
    );
    const recipients = [
      {
        channel: 'EMAIL' as const,
        enabled: notificationConfig.emailEnabled,
        recipient:
          (job?.customerEmail || customer?.email || '').trim().toLowerCase(),
      },
      {
        channel: 'SMS' as const,
        enabled: notificationConfig.smsEnabled,
        recipient: (job?.customerPhone || customer?.phone || '').trim(),
      },
    ];

    const saved = await Promise.all(
      recipients.map(async ({ channel, enabled, recipient }) => {
        const delivery = this.deliveries.create({
          organizationId: input.organizationId || null,
          routeId: input.routeId || null,
          routeRunStopId: input.routeRunStopId || null,
          jobId: input.jobId || null,
          customerId: customer?.id || input.customerId || null,
          eventType: input.eventType,
          channel,
          recipient: recipient || `${channel.toLowerCase()}-missing`,
          provider:
            channel === 'EMAIL'
              ? this.getEmailProvider()
              : this.getSmsProvider(),
          status: 'PENDING',
          subject: channel === 'EMAIL' ? composed.subject : null,
          message: composed.message,
          trackingUrl: input.trackingUrl || null,
          metadata: {
            brandName,
            supportEmail: branding.supportEmail,
            supportPhone: branding.supportPhone,
          },
        });

        if (!enabled) {
          delivery.status = 'SKIPPED';
          delivery.failureReason = `${channel} notifications are disabled`;
          return this.deliveries.save(delivery);
        }

        if (!recipient) {
          delivery.status = 'SKIPPED';
          delivery.failureReason = `Missing ${channel.toLowerCase()} recipient`;
          return this.deliveries.save(delivery);
        }

        const result =
          channel === 'EMAIL'
            ? await this.deliverEmail(
                recipient,
                composed.subject,
                composed.message,
                branding,
                notificationConfig,
              )
            : await this.deliverSms(recipient, composed.message);

        delivery.provider = result.provider;
        delivery.status = result.status;
        delivery.providerMessageId =
          'providerMessageId' in result ? result.providerMessageId || null : null;
        delivery.failureReason =
          'failureReason' in result ? result.failureReason || null : null;
        if (result.status === 'SENT') {
          delivery.sentAt = new Date();
        }
        return this.deliveries.save(delivery);
      }),
    );

    this.logger.log(
      `Notification event ${input.eventType} created ${saved.length} delivery records`,
    );
    return saved;
  }
}
