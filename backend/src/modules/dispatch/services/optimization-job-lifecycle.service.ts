import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { OptimizationObjective } from '../../../../../shared/contracts';

export type OptimizationJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type OptimizationJobKind = 'single-route' | 'global-route' | 'reroute';

export interface OptimizationJobRecord {
  id: string;
  kind: OptimizationJobKind;
  objective?: OptimizationObjective;
  routeId?: string;
  organizationId?: string;
  vehicleIds?: string[];
  jobIds?: string[];
  resultRouteIds?: string[];
  status: OptimizationJobStatus;
  fallbackUsed?: boolean;
  warnings?: string[];
  metrics?: Record<string, unknown>;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  updatedAt: string;
  error?: string;
}

@Injectable()
export class OptimizationJobLifecycleService {
  private readonly jobs = new Map<string, OptimizationJobRecord>();

  create(seed: Partial<Omit<OptimizationJobRecord, 'id' | 'createdAt' | 'updatedAt' | 'status'>> = {}): OptimizationJobRecord {
    const now = new Date().toISOString();
    const record: OptimizationJobRecord = {
      id: randomUUID(),
      kind: seed.kind || 'single-route',
      routeId: seed.routeId,
      organizationId: seed.organizationId,
      vehicleIds: seed.vehicleIds || [],
      jobIds: seed.jobIds || [],
      resultRouteIds: seed.resultRouteIds || [],
      status: 'queued',
      fallbackUsed: Boolean(seed.fallbackUsed),
      warnings: seed.warnings || [],
      metrics: seed.metrics || {},
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(record.id, record);
    return record;
  }

  update(
    jobId: string,
    status: OptimizationJobStatus,
    patch: Partial<Omit<OptimizationJobRecord, 'id' | 'createdAt'>> = {},
  ): OptimizationJobRecord | null {
    const current = this.jobs.get(jobId);
    if (!current) return null;
    const now = new Date().toISOString();
    const next: OptimizationJobRecord = {
      ...current,
      ...patch,
      status,
      error: patch.error === undefined ? current.error : patch.error,
      startedAt:
        status === 'running' ? current.startedAt || now : current.startedAt,
      completedAt:
        status === 'completed' ? patch.completedAt || now : current.completedAt,
      cancelledAt:
        status === 'cancelled' ? patch.cancelledAt || now : current.cancelledAt,
      updatedAt: now,
    };
    this.jobs.set(jobId, next);
    return next;
  }

  list(limit = 100): OptimizationJobRecord[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, limit);
  }
}
