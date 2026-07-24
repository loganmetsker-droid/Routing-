import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
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
  organizationId: string;
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

type DeliveryAttemptResult = {
  provider: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  providerMessageId?: string | null;
  failureReason?: string | null;
  providerStatus?: number | null;
  retryable: boolean;
  outcomeUnknown?: boolean;
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
    const smsEnabled =
      this.configService.get<string>('SMS_NOTIFICATIONS_ENABLED', 'false') ===
      'true';
    return smsEnabled &&
      this.configService.get<string>('TWILIO_ACCOUNT_SID') &&
      this.configService.get<string>('TWILIO_AUTH_TOKEN') &&
      this.configService.get<string>('TWILIO_FROM_NUMBER')
      ? 'twilio'
      : 'disabled';
  }

  private getMaxAttempts() {
    const configured = Number(
      this.configService.get<string>('NOTIFICATION_MAX_ATTEMPTS', '3'),
    );
    return Number.isFinite(configured)
      ? Math.max(1, Math.min(10, Math.floor(configured)))
      : 3;
  }

  private getRetryBaseSeconds() {
    const configured = Number(
      this.configService.get<string>(
        'NOTIFICATION_RETRY_BASE_SECONDS',
        '60',
      ),
    );
    return Number.isFinite(configured)
      ? Math.max(5, Math.min(3_600, Math.floor(configured)))
      : 60;
  }

  private buildIdempotencyKey(
    input: NotifyCustomerInput,
    channel: 'EMAIL' | 'SMS',
    recipient: string,
  ) {
    return createHash('sha256')
      .update(
        JSON.stringify([
          input.organizationId,
          input.routeId || null,
          input.routeRunStopId || null,
          input.jobId || null,
          input.customerId || null,
          input.eventType,
          channel,
          recipient,
          input.eta || null,
          input.reason || null,
        ]),
      )
      .digest('hex');
  }

  private isUniqueViolation(error: unknown) {
    return Boolean(
      error &&
        typeof error === 'object' &&
        'code' in error &&
        String((error as { code?: unknown }).code) === '23505',
    );
  }

  private getNextAttemptAt(attempts: number) {
    const delaySeconds = Math.min(
      60 * 60,
      this.getRetryBaseSeconds() * 5 ** Math.max(0, attempts - 1),
    );
    return new Date(Date.now() + delaySeconds * 1_000);
  }

  private async reserveDelivery(delivery: NotificationDelivery) {
    try {
      return {
        delivery: await this.deliveries.save(delivery),
        reserved: true,
      };
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }
      const existing = await this.deliveries.findOne({
        where: { idempotencyKey: delivery.idempotencyKey },
      });
      if (!existing) {
        throw error;
      }
      return { delivery: existing, reserved: false };
    }
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
        this.configService.get<string>(
          'SMS_NOTIFICATIONS_ENABLED',
          'false',
        ) === 'true' && notifications.smsEnabled === true,
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
        retryable: false,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
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
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!response.ok) {
        const retryable = [408, 425, 429, 500, 502, 503, 504].includes(
          response.status,
        );
        return {
          provider: 'postmark',
          status: 'FAILED' as const,
          providerStatus: response.status,
          retryable,
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
        providerStatus: response.status,
        retryable: false,
      };
    } catch (error) {
      return {
        provider: 'postmark',
        status: 'FAILED' as const,
        retryable: false,
        outcomeUnknown: true,
        failureReason:
          error instanceof Error && error.name === 'AbortError'
            ? 'Postmark request timed out'
            : error instanceof Error
              ? error.message
              : String(error),
      };
    } finally {
      clearTimeout(timer);
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
        retryable: false,
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
        const retryable = [408, 425, 429, 500, 502, 503, 504].includes(
          response.status,
        );
        return {
          provider: 'twilio',
          status: 'FAILED' as const,
          providerStatus: response.status,
          retryable,
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
        providerStatus: response.status,
        retryable: false,
      };
    } catch (error) {
      return {
        provider: 'twilio',
        status: 'FAILED' as const,
        retryable: false,
        outcomeUnknown: true,
        failureReason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private getStoredBranding(
    delivery: NotificationDelivery,
  ): BrandingConfig {
    const metadata = delivery.metadata || {};
    return {
      brandName:
        typeof metadata.brandName === 'string' ? metadata.brandName : null,
      supportEmail:
        typeof metadata.supportEmail === 'string'
          ? metadata.supportEmail
          : null,
      supportPhone:
        typeof metadata.supportPhone === 'string'
          ? metadata.supportPhone
          : null,
    };
  }

  private getStoredNotificationConfig(
    delivery: NotificationDelivery,
  ): NotificationConfig {
    const metadata = delivery.metadata || {};
    return {
      emailEnabled: delivery.channel === 'EMAIL',
      smsEnabled: delivery.channel === 'SMS',
      replyToEmail:
        typeof metadata.replyToEmail === 'string'
          ? metadata.replyToEmail
          : null,
    };
  }

  private async attemptDelivery(delivery: NotificationDelivery) {
    const branding = this.getStoredBranding(delivery);
    const notificationConfig = this.getStoredNotificationConfig(delivery);
    delivery.attempts = Number(delivery.attempts || 0) + 1;
    delivery.lastAttemptAt = new Date();
    delivery.status = 'PENDING';
    await this.deliveries.save(delivery);

    const result: DeliveryAttemptResult =
      delivery.channel === 'EMAIL'
        ? await this.deliverEmail(
            delivery.recipient,
            delivery.subject || 'Delivery update',
            delivery.message,
            branding,
            notificationConfig,
          )
        : await this.deliverSms(delivery.recipient, delivery.message);

    delivery.provider = result.provider;
    delivery.status = result.status;
    delivery.providerMessageId = result.providerMessageId || null;
    delivery.failureReason = result.failureReason || null;
    delivery.attemptToken = null;
    delivery.leaseExpiresAt = null;
    delivery.metadata = {
      ...(delivery.metadata || {}),
      retryable: result.retryable,
      outcomeUnknown: Boolean(result.outcomeUnknown),
      providerStatus: result.providerStatus || null,
    };

    if (result.status === 'SENT') {
      delivery.sentAt = new Date();
      delivery.nextAttemptAt = null;
    } else if (
      result.status === 'FAILED' &&
      result.retryable &&
      delivery.attempts < this.getMaxAttempts()
    ) {
      delivery.nextAttemptAt = this.getNextAttemptAt(delivery.attempts);
    } else {
      delivery.nextAttemptAt = null;
    }

    return this.deliveries.save(delivery);
  }

  private async claimRetry(delivery: NotificationDelivery) {
    const now = new Date();
    const attemptToken = randomUUID();
    const leaseExpiresAt = new Date(now.getTime() + 2 * 60 * 1_000);
    const claimed = await this.deliveries.update(
      {
        id: delivery.id,
        status: 'FAILED',
        nextAttemptAt: LessThanOrEqual(now),
      },
      {
        status: 'PENDING',
        nextAttemptAt: null,
        attemptToken,
        leaseExpiresAt,
      },
    );
    if (claimed.affected !== 1) {
      return null;
    }
    return this.deliveries.findOne({
      where: { id: delivery.id, attemptToken },
    });
  }

  async retryDueDeliveries(limit = 25) {
    const now = new Date();
    const due = await this.deliveries.find({
      where: {
        status: 'FAILED',
        nextAttemptAt: LessThanOrEqual(now),
      },
      order: { nextAttemptAt: 'ASC' },
      take: Math.max(1, Math.min(100, limit)),
    });

    const results = await Promise.all(
      due.map(async (candidate) => {
        const claimed = await this.claimRetry(candidate);
        return claimed ? this.attemptDelivery(claimed) : null;
      }),
    );
    const attempted = results.filter(
      (delivery): delivery is NotificationDelivery => Boolean(delivery),
    );
    return {
      attempted: attempted.length,
      sent: attempted.filter((delivery) => delivery.status === 'SENT').length,
      failed: attempted.filter((delivery) => delivery.status === 'FAILED')
        .length,
    };
  }

  async getOverview(organizationId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [sent24h, failed24h, pendingReview24h, recent] = await Promise.all([
      this.deliveries.count({
        where: {
          organizationId,
          status: 'SENT',
          createdAt: MoreThan(since),
        },
      }),
      this.deliveries.count({
        where: {
          organizationId,
          status: 'FAILED',
          createdAt: MoreThan(since),
        },
      }),
      this.deliveries.count({
        where: {
          organizationId,
          status: 'PENDING',
          createdAt: MoreThan(since),
          leaseExpiresAt: LessThanOrEqual(new Date()),
        },
      }),
      this.deliveries.find({
        where: { organizationId },
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
      pendingReviewLast24Hours: pendingReview24h,
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

  async checkReadiness() {
    const token = this.configService.get<string>('POSTMARK_SERVER_TOKEN');
    const fromEmail =
      this.configService.get<string>('POSTMARK_FROM_EMAIL') ||
      this.configService.get<string>('NOTIFICATION_FROM_EMAIL');
    if (!token || !fromEmail) {
      return {
        configured: false,
        status: 'missing' as const,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4_000);
    try {
      const response = await fetch('https://api.postmarkapp.com/server', {
        headers: {
          accept: 'application/json',
          'x-postmark-server-token': token,
        },
        signal: controller.signal,
      });

      return {
        configured: true,
        status: response.ok ? ('up' as const) : ('down' as const),
        providerStatus: response.status,
      };
    } catch {
      return {
        configured: true,
        status: 'down' as const,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async list(organizationId: string, routeId?: string) {
    return this.deliveries.find({
      where: {
        organizationId,
        ...(routeId ? { routeId } : {}),
      },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async notifyCustomer(input: NotifyCustomerInput) {
    const [job, organization] = await Promise.all([
      input.jobId
        ? this.jobs.findOne({
            where: {
              id: input.jobId,
              organizationId: input.organizationId,
            },
          })
        : null,
      this.organizations.findOne({ where: { id: input.organizationId } }),
    ]);
    const customer = input.customerId
      ? await this.customers.findOne({
          where: {
            id: input.customerId,
            organizationId: input.organizationId,
          },
        })
      : job?.customerId
        ? await this.customers.findOne({
            where: {
              id: job.customerId,
              organizationId: input.organizationId,
            },
          })
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
        const normalizedRecipient =
          recipient || `${channel.toLowerCase()}-missing`;
        const delivery = this.deliveries.create({
          organizationId: input.organizationId,
          routeId: input.routeId || null,
          routeRunStopId: input.routeRunStopId || null,
          jobId: input.jobId || null,
          customerId: customer?.id || input.customerId || null,
          eventType: input.eventType,
          idempotencyKey: this.buildIdempotencyKey(
            input,
            channel,
            normalizedRecipient,
          ),
          channel,
          recipient: normalizedRecipient,
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
            replyToEmail: notificationConfig.replyToEmail,
          },
          attempts: 0,
          lastAttemptAt: null,
          nextAttemptAt: null,
          attemptToken: null,
          leaseExpiresAt: null,
        });

        if (!enabled) {
          delivery.status = 'SKIPPED';
          delivery.failureReason = `${channel} notifications are disabled`;
        } else if (!recipient) {
          delivery.status = 'SKIPPED';
          delivery.failureReason = `Missing ${channel.toLowerCase()} recipient`;
        } else {
          delivery.attemptToken = randomUUID();
          delivery.leaseExpiresAt = new Date(Date.now() + 2 * 60 * 1_000);
        }

        const reservation = await this.reserveDelivery(delivery);
        if (!reservation.reserved || reservation.delivery.status === 'SKIPPED') {
          return reservation.delivery;
        }
        return this.attemptDelivery(reservation.delivery);
      }),
    );

    this.logger.log(
      `Notification event ${input.eventType} resolved ${saved.length} delivery records`,
    );
    return saved;
  }
}
