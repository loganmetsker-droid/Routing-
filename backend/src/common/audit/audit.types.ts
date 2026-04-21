export type AuditActorType = 'user' | 'system' | 'ai' | 'integration';

export interface AuditEntry {
  actorId: string;
  actorType: AuditActorType;
  timestamp: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  source: AuditActorType;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}
