import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { CreateMarketingLeadDto } from './dto/create-marketing-lead.dto';
import {
  MarketingLead,
  MarketingLeadStatus,
} from './entities/marketing-lead.entity';

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_MAX_NOTIFICATION_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_SECONDS = 60;
const MAX_RETRY_DELAY_SECONDS = 60 * 60;

@Injectable()
export class MarketingLeadsService {
  private readonly logger = new Logger(MarketingLeadsService.name);

  constructor(
    @InjectRepository(MarketingLead)
    private readonly leads: Repository<MarketingLead>,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateMarketingLeadDto) {
    if (dto.website?.trim()) {
      return { id: 'accepted', duplicate: false, notificationStatus: 'skipped' as const };
    }

    const existing = await this.leads.findOne({
      where: {
        workEmail: dto.workEmail,
        createdAt: MoreThan(new Date(Date.now() - DUPLICATE_WINDOW_MS)),
      },
      order: { createdAt: 'DESC' },
    });
    if (existing) {
      return {
        id: existing.id,
        duplicate: true,
        notificationStatus: existing.notificationStatus,
      };
    }

    const lead = await this.leads.save(
      this.leads.create({
        name: dto.name,
        workEmail: dto.workEmail,
        company: dto.company,
        fleetSize: dto.fleetSize,
        exactFleetSize: dto.exactFleetSize ?? null,
        requestType: dto.requestType,
        notes: dto.notes || null,
        source: dto.source || 'trytrovan.com',
        pagePath: dto.pagePath || null,
        status: 'new',
        notificationStatus: 'pending',
        notificationAttempts: 0,
        lastNotificationAttemptAt: null,
        nextNotificationAttemptAt: null,
      }),
    );

    await this.deliverOperatorNotification(lead);
    return {
      id: lead.id,
      duplicate: false,
      notificationStatus: lead.notificationStatus,
    };
  }

  hasOperatorAccess(email?: string | null) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return false;
    const allowedEmails = String(
      this.config.get<string>('LEAD_INTAKE_OPERATOR_EMAILS') || '',
    )
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    return allowedEmails.includes(normalizedEmail);
  }

  assertOperatorAccess(email?: string | null) {
    if (!this.hasOperatorAccess(email)) {
      throw new ForbiddenException('Platform operator access required');
    }
  }

  list(status?: MarketingLeadStatus) {
    return this.leads.find({
      where: status ? { status } : undefined,
      order: { createdAt: 'DESC' },
      take: 250,
    });
  }

  async updateStatus(id: string, status: MarketingLeadStatus) {
    const lead = await this.leads.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    lead.status = status;
    return this.leads.save(lead);
  }

  async retryOperatorNotification(id: string) {
    const lead = await this.leads.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.notificationStatus === 'sent') {
      throw new ConflictException('Operator notification was already delivered');
    }
    if (lead.notificationStatus === 'pending') {
      throw new ConflictException('Operator notification is already in progress');
    }

    const claim = await this.leads.update(
      { id: lead.id, notificationStatus: lead.notificationStatus },
      {
        notificationStatus: 'pending',
        notificationError: 'Manual retry in progress',
        nextNotificationAttemptAt: null,
      },
    );
    if (claim.affected !== 1) {
      throw new ConflictException(
        'Operator notification state changed; refresh before retrying',
      );
    }
    lead.notificationStatus = 'pending';
    lead.notificationError = 'Manual retry in progress';
    lead.nextNotificationAttemptAt = null;
    return this.deliverOperatorNotification(lead);
  }

  async retryDueOperatorNotifications() {
    const due = await this.leads.find({
      where: {
        notificationStatus: 'failed',
        nextNotificationAttemptAt: LessThanOrEqual(new Date()),
      },
      order: { nextNotificationAttemptAt: 'ASC' },
      take: 25,
    });

    const results: MarketingLead[] = [];
    for (const lead of due) {
      const claim = await this.leads.update(
        {
          id: lead.id,
          notificationStatus: 'failed',
          nextNotificationAttemptAt: LessThanOrEqual(new Date()),
        },
        {
          notificationStatus: 'pending',
          notificationError: 'Scheduled retry in progress',
          nextNotificationAttemptAt: null,
        },
      );
      if (claim.affected !== 1) continue;
      lead.notificationStatus = 'pending';
      lead.notificationError = 'Scheduled retry in progress';
      lead.nextNotificationAttemptAt = null;
      results.push(await this.deliverOperatorNotification(lead));
    }

    return {
      attempted: results.length,
      sent: results.filter((lead) => lead.notificationStatus === 'sent').length,
      failed: results.filter((lead) => lead.notificationStatus === 'failed')
        .length,
    };
  }

  private getMaxNotificationAttempts() {
    const configured = Number(
      this.config.get<string>('LEAD_NOTIFICATION_MAX_ATTEMPTS'),
    );
    return Number.isInteger(configured) && configured > 0
      ? configured
      : DEFAULT_MAX_NOTIFICATION_ATTEMPTS;
  }

  private getRetryBaseSeconds() {
    const configured = Number(
      this.config.get<string>('LEAD_NOTIFICATION_RETRY_BASE_SECONDS'),
    );
    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_RETRY_BASE_SECONDS;
  }

  private getNextAttemptAt(attempts: number) {
    const delaySeconds = Math.min(
      this.getRetryBaseSeconds() * 5 ** Math.max(0, attempts - 1),
      MAX_RETRY_DELAY_SECONDS,
    );
    return new Date(Date.now() + delaySeconds * 1000);
  }

  private isConfirmedTransientStatus(status: number) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  private async deliverOperatorNotification(lead: MarketingLead) {
    const token = this.config.get<string>('POSTMARK_SERVER_TOKEN');
    const from = this.config.get<string>('LEAD_INTAKE_FROM_EMAIL');
    const to = this.config.get<string>('LEAD_INTAKE_EMAIL');

    if (!token || !from || !to) {
      lead.notificationStatus = 'skipped';
      lead.notificationError = 'Operator email is not configured';
      lead.nextNotificationAttemptAt = null;
      await this.leads.save(lead);
      return lead;
    }

    lead.notificationAttempts = Number(lead.notificationAttempts || 0) + 1;
    lead.lastNotificationAttemptAt = new Date();
    lead.nextNotificationAttemptAt = null;
    lead.notificationStatus = 'pending';
    lead.notificationError =
      'Delivery in progress; review this lead if the state does not resolve';
    await this.leads.save(lead);

    try {
      const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': token,
        },
        body: JSON.stringify({
          From: from,
          To: to,
          ReplyTo: lead.workEmail,
          Subject: `Trovan ${lead.requestType}: ${lead.company}`,
          TextBody: [
            `Name: ${lead.name}`,
            `Email: ${lead.workEmail}`,
            `Company: ${lead.company}`,
            `Fleet: ${lead.exactFleetSize || lead.fleetSize}`,
            `Request: ${lead.requestType}`,
            lead.pagePath ? `Page: ${lead.pagePath}` : '',
            lead.notes ? `Notes: ${lead.notes}` : '',
            `Lead ID: ${lead.id}`,
          ].filter(Boolean).join('\n'),
          MessageStream: 'outbound',
        }),
        signal: AbortSignal.timeout(8_000),
      });

      if (response.ok) {
        lead.notificationStatus = 'sent';
        lead.notificationError = null;
      } else {
        const retryable =
          this.isConfirmedTransientStatus(response.status) &&
          lead.notificationAttempts < this.getMaxNotificationAttempts();
        lead.notificationStatus = 'failed';
        lead.notificationError = retryable
          ? `Postmark returned ${response.status}; retry scheduled`
          : `Postmark rejected delivery with status ${response.status}`;
        lead.nextNotificationAttemptAt = retryable
          ? this.getNextAttemptAt(lead.notificationAttempts)
          : null;
        this.logger.error(
          `Lead ${lead.id} persisted but operator notification returned ${response.status}`,
        );
      }
    } catch (error) {
      lead.notificationStatus = 'failed';
      lead.notificationError =
        'Delivery outcome is uncertain; operator review required before retry';
      lead.nextNotificationAttemptAt = null;
      this.logger.error(
        `Lead ${lead.id} persisted but operator notification outcome is uncertain: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
    return this.leads.save(lead);
  }
}
