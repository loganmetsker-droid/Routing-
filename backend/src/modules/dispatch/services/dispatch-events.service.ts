import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DispatchEvent } from '../entities/dispatch-event.entity';
import { deriveDispatchEventIndexFields } from '../dispatch-event-indexing';
import { normalizeTimelineFilters } from '../timeline-query';
import type {
  DispatchEventInput,
  DispatchTimelineFilters,
} from '../dispatch.types';

@Injectable()
export class DispatchEventsService {
  private readonly logger = new Logger(DispatchEventsService.name);

  constructor(
    @InjectRepository(DispatchEvent)
    private readonly dispatchEventRepository: Repository<DispatchEvent>,
    private readonly configService: ConfigService,
  ) {}

  private async pruneDispatchEventsIfNeeded() {
    const retentionDays = Number(
      this.configService.get<string>('DISPATCH_EVENT_RETENTION_DAYS', '30'),
    );
    if (Number.isNaN(retentionDays) || retentionDays <= 0) return;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    await this.dispatchEventRepository
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff: cutoff.toISOString() })
      .execute();
  }

  async log(event: DispatchEventInput) {
    try {
      const indexed = deriveDispatchEventIndexFields({
        reasonCode: event.reasonCode,
        action: event.action,
        actor: event.actor,
        packId: event.packId,
        payload: event.payload || null,
      });
      const entity = this.dispatchEventRepository.create({
        routeId: event.routeId || null,
        aggregateType: event.aggregateType || 'ROUTE',
        aggregateId: event.aggregateId || event.routeId || null,
        eventType: event.eventType || event.code,
        actorUserId: event.actorUserId || null,
        source: event.source,
        level: event.level || 'info',
        code: event.code,
        message: event.message,
        payload: event.payload || {},
        reasonCode: indexed.reasonCode,
        action: indexed.action,
        actor: indexed.actor || event.actor || event.actorUserId || 'system',
        packId: indexed.packId,
      });
      await this.dispatchEventRepository.save(entity);
      await this.pruneDispatchEventsIfNeeded();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error || 'unknown error');
      this.logger.warn(
        `Failed to persist dispatch event (${event.code}): ${message}`,
      );
    }
  }

  async getTimeline(
    routeId?: string,
    limit = 100,
    filters: DispatchTimelineFilters = {},
  ): Promise<DispatchEvent[]> {
    const capped = Math.max(1, Math.min(500, limit));
    const normalizedFilters = normalizeTimelineFilters(filters);
    const qb = this.dispatchEventRepository
      .createQueryBuilder('event')
      .orderBy('event.created_at', 'DESC')
      .take(capped);

    if (routeId) {
      qb.andWhere('event.route_id = :routeId', { routeId });
    }
    if (normalizedFilters.source) {
      qb.andWhere('event.source = :source', {
        source: normalizedFilters.source,
      });
    }
    if (normalizedFilters.before) {
      qb.andWhere('event.created_at < :before', {
        before: normalizedFilters.before,
      });
    }
    if (normalizedFilters.reasonCode) {
      qb.andWhere(
        '(event.reason_code = :reasonCodeExact OR CAST(event.payload AS text) ILIKE :reasonCodeLike)',
        {
          reasonCodeExact: normalizedFilters.reasonCode,
          reasonCodeLike: `%${normalizedFilters.reasonCode}%`,
        },
      );
    }
    if (normalizedFilters.action) {
      qb.andWhere(
        '(event.action = :actionExact OR CAST(event.payload AS text) ILIKE :actionLike)',
        {
          actionExact: normalizedFilters.action,
          actionLike: `%${normalizedFilters.action}%`,
        },
      );
    }
    if (normalizedFilters.actor) {
      qb.andWhere(
        '(event.actor = :actorExact OR CAST(event.payload AS text) ILIKE :actorLike)',
        {
          actorExact: normalizedFilters.actor,
          actorLike: `%${normalizedFilters.actor}%`,
        },
      );
    }
    if (normalizedFilters.packId) {
      qb.andWhere(
        '(event.pack_id = :packIdExact OR CAST(event.payload AS text) ILIKE :packIdLike)',
        {
          packIdExact: normalizedFilters.packId,
          packIdLike: `%${normalizedFilters.packId}%`,
        },
      );
    }

    return qb.getMany();
  }
}
