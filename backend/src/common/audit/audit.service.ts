import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainEvents } from '../events/event-types';
import { AuditEntry } from './audit.types';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService');
  private readonly entries: AuditEntry[] = [];

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
    private readonly configService: ConfigService,
  ) {}

  record(entry: Omit<AuditEntry, 'timestamp'>): AuditEntry {
    const payload: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    this.entries.unshift(payload);
    void this.auditLogs.save(
      this.auditLogs.create({
        organizationId: (payload.metadata?.organizationId as string | undefined) || undefined,
        actorId: payload.actorId,
        actorType: payload.actorType,
        entityType: payload.entityType,
        entityId: payload.entityId,
        action: payload.action,
        source: payload.source,
        previousValue: (payload.oldValue as Record<string, unknown> | undefined) || undefined,
        newValue: (payload.newValue as Record<string, unknown> | undefined) || undefined,
      }),
    ).catch((error) => {
      this.logger.warn(`Failed to persist audit log: ${error?.message || error}`);
    });
    this.logger.log(
      JSON.stringify({
        event: DomainEvents.system.auditLogged,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        actorId: payload.actorId,
        source: payload.source,
      }),
    );
    return payload;
  }

  list(limit = 100): AuditEntry[] {
    return this.entries.slice(0, limit);
  }

  async listPersisted({
    limit = 100,
    organizationId,
    action,
    entityType,
    actorId,
  }: {
    limit?: number;
    organizationId?: string;
    action?: string;
    entityType?: string;
    actorId?: string;
  }) {
    const query = this.auditLogs
      .createQueryBuilder('audit')
      .orderBy('audit.created_at', 'DESC')
      .limit(limit);
    if (organizationId) {
      query.andWhere('audit.organization_id = :organizationId', { organizationId });
    }
    if (action) {
      query.andWhere('audit.action = :action', { action });
    }
    if (entityType) {
      query.andWhere('audit.entity_type = :entityType', { entityType });
    }
    if (actorId) {
      query.andWhere('audit.actor_id = :actorId', { actorId });
    }
    return query.getMany();
  }

  async getOverview({ organizationId }: { organizationId?: string }) {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const queryBase = this.auditLogs.createQueryBuilder('audit');

    const applyOrgScope = <T extends ReturnType<typeof queryBase.clone>>(query: T) => {
      if (organizationId) {
        query.andWhere('audit.organization_id = :organizationId', {
          organizationId,
        });
      }
      return query;
    };

    const [totalEntries, last24hEntries, last7dEntries, actionBreakdown, recentEntries] =
      await Promise.all([
        applyOrgScope(queryBase.clone()).getCount(),
        applyOrgScope(queryBase.clone())
          .andWhere('audit.created_at >= :last24h', { last24h })
          .getCount(),
        applyOrgScope(queryBase.clone())
          .andWhere('audit.created_at >= :last7d', { last7d })
          .getCount(),
        applyOrgScope(
          queryBase
            .clone()
            .select('audit.action', 'action')
            .addSelect('COUNT(*)', 'count')
            .groupBy('audit.action')
            .orderBy('COUNT(*)', 'DESC')
            .limit(8),
        ).getRawMany<{ action: string; count: string }>(),
        this.listPersisted({ limit: 8, organizationId }),
      ]);

    return {
      generatedAt: now.toISOString(),
      controls: {
        requestIdsEnabled: true,
        structuredRequestLogging: true,
        sensitiveFieldRedaction: true,
        authMode:
          this.configService.get('NODE_ENV') === 'production'
            ? 'jwt'
            : 'local-admin-jwt',
        auditRetentionDays: Number(
          this.configService.get('AUDIT_LOG_RETENTION_DAYS', 90),
        ),
        dispatchEventRetentionDays: Number(
          this.configService.get('DISPATCH_EVENT_RETENTION_DAYS', 90),
        ),
      },
      counts: {
        totalEntries,
        last24hEntries,
        last7dEntries,
      },
      actionBreakdown: actionBreakdown.map((item) => ({
        action: item.action,
        count: Number(item.count || 0),
      })),
      recentEntries,
    };
  }
}
