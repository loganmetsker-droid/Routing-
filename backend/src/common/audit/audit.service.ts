import { Injectable, Logger } from '@nestjs/common';
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

  async listPersisted({ limit = 100, organizationId }: { limit?: number; organizationId?: string }) {
    const query = this.auditLogs.createQueryBuilder('audit').orderBy('audit.created_at', 'DESC').limit(limit);
    if (organizationId) {
      query.andWhere('audit.organization_id = :organizationId', { organizationId });
    }
    return query.getMany();
  }
}
