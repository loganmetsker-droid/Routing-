import { timingSafeEqual, createHmac } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ErrorMonitoringService } from '../../common/monitoring/error-monitoring.service';
import { PostmarkBounceDto } from './dto/postmark-bounce.dto';
import { PostmarkBounceEvent } from './entities/postmark-bounce-event.entity';

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseBasicAuthorization(value?: string) {
  if (!value || value.length > 1_024) return null;
  const match = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(value.trim());
  if (!match) return null;
  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator <= 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

@Injectable()
export class PostmarkEventsService {
  constructor(
    @InjectRepository(PostmarkBounceEvent)
    private readonly bounces: Repository<PostmarkBounceEvent>,
    private readonly config: ConfigService,
    private readonly monitoring: ErrorMonitoringService,
  ) {}

  assertAuthorized(authorization?: string) {
    const expectedUsername = String(
      this.config.get('POSTMARK_WEBHOOK_USERNAME', ''),
    ).trim();
    const expectedPassword = String(
      this.config.get('POSTMARK_WEBHOOK_PASSWORD', ''),
    ).trim();
    const presented = parseBasicAuthorization(authorization);
    if (
      !expectedUsername ||
      !expectedPassword ||
      !presented ||
      !safeEqual(presented.username, expectedUsername) ||
      !safeEqual(presented.password, expectedPassword)
    ) {
      throw new UnauthorizedException('Invalid Postmark webhook credentials');
    }
  }

  private recipientHash(email: string) {
    const key = String(
      this.config.get('POSTMARK_BOUNCE_HASH_KEY') ||
        this.config.get('JWT_SECRET') ||
        '',
    );
    if (!key) throw new Error('POSTMARK_BOUNCE_HASH_KEY is not configured');
    return createHmac('sha256', key)
      .update(email.trim().toLowerCase())
      .digest('hex');
  }

  async recordBounce(dto: PostmarkBounceDto) {
    const providerBounceId = String(dto.ID);
    const existing = await this.bounces.findOne({
      where: { providerBounceId },
    });
    if (existing) return { event: existing, duplicate: true };

    const leadId =
      typeof dto.Metadata?.trovanLeadId === 'string' &&
      /^[0-9a-f-]{36}$/i.test(dto.Metadata.trovanLeadId)
        ? dto.Metadata.trovanLeadId
        : null;
    const pendingEvent = this.bounces.create({
        providerBounceId,
        messageId: dto.MessageID,
        recordType: dto.RecordType,
        bounceType: dto.Type,
        bounceName: dto.Name,
        typeCode: dto.TypeCode ?? null,
        messageStream: dto.MessageStream || null,
        recipientHash: this.recipientHash(dto.Email),
        inactive: dto.Inactive,
        providerBouncedAt: dto.BouncedAt ? new Date(dto.BouncedAt) : null,
        leadId,
      });
    let event: PostmarkBounceEvent;
    try {
      event = await this.bounces.save(pendingEvent);
    } catch (error) {
      const driverCode =
        error instanceof QueryFailedError
          ? String((error.driverError as { code?: unknown })?.code || '')
          : String((error as { code?: unknown })?.code || '');
      if (driverCode !== '23505') throw error;
      const racedDuplicate = await this.bounces.findOne({
        where: { providerBounceId },
      });
      if (!racedDuplicate) throw error;
      return { event: racedDuplicate, duplicate: true };
    }

    this.monitoring.capture({
      source: 'backend',
      name: 'PostmarkBounce',
      message: `Postmark reported ${event.bounceType}`,
      context: {
        messageId: event.messageId,
        bounceType: event.bounceType,
        inactive: event.inactive,
        leadId: event.leadId,
      },
    });
    return { event, duplicate: false };
  }

  listBounces(messageId?: string) {
    return this.bounces.find({
      where: messageId ? { messageId } : undefined,
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
}
