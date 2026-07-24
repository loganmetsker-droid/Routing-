import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { CreateMarketingLeadDto } from './dto/create-marketing-lead.dto';
import {
  MarketingLead,
  MarketingLeadStatus,
} from './entities/marketing-lead.entity';

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

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
      }),
    );

    await this.notifyOperator(lead);
    return {
      id: lead.id,
      duplicate: false,
      notificationStatus: lead.notificationStatus,
    };
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

  private async notifyOperator(lead: MarketingLead) {
    const token = this.config.get<string>('POSTMARK_SERVER_TOKEN');
    const from = this.config.get<string>('LEAD_INTAKE_FROM_EMAIL');
    const to = this.config.get<string>('LEAD_INTAKE_EMAIL');

    if (!token || !from || !to) {
      lead.notificationStatus = 'skipped';
      lead.notificationError = 'Operator email is not configured';
      await this.leads.save(lead);
      return;
    }

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
      if (!response.ok) throw new Error(`Postmark returned ${response.status}`);
      lead.notificationStatus = 'sent';
      lead.notificationError = null;
    } catch (error) {
      lead.notificationStatus = 'failed';
      lead.notificationError = 'Operator notification failed';
      this.logger.error(
        `Lead ${lead.id} persisted but operator notification failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
    await this.leads.save(lead);
  }
}
