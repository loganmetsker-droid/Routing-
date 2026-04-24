import { unwrapApiData, unwrapListItems } from '@shared/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api.session';
import { isPreview, previewState } from './api.preview';
import {
  type AuditLogRecord,
  type AuditOverviewRecord,
  isRecord,
} from './api.types';
import { queryKeys } from './queryKeys';

const normalizeAuditEntry = (value: unknown): AuditLogRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : `audit-${Math.random().toString(36).slice(2, 8)}`,
    organizationId:
      typeof record.organizationId === 'string' ? record.organizationId : null,
    actorId: typeof record.actorId === 'string' ? record.actorId : 'unknown',
    actorType:
      typeof record.actorType === 'string' ? record.actorType : 'system',
    entityType:
      typeof record.entityType === 'string' ? record.entityType : 'unknown',
    entityId: typeof record.entityId === 'string' ? record.entityId : 'unknown',
    action: typeof record.action === 'string' ? record.action : 'unknown',
    source: typeof record.source === 'string' ? record.source : 'system',
    createdAt:
      typeof record.createdAt === 'string'
        ? record.createdAt
        : new Date().toISOString(),
  };
};

const normalizeAuditOverview = (value: unknown): AuditOverviewRecord => {
  const record = isRecord(value) ? value : {};
  const controls = isRecord(record.controls) ? record.controls : {};
  const counts = isRecord(record.counts) ? record.counts : {};

  return {
    generatedAt:
      typeof record.generatedAt === 'string'
        ? record.generatedAt
        : new Date().toISOString(),
    controls: {
      requestIdsEnabled: Boolean(controls.requestIdsEnabled),
      structuredRequestLogging: Boolean(controls.structuredRequestLogging),
      sensitiveFieldRedaction: Boolean(controls.sensitiveFieldRedaction),
      authMode:
        typeof controls.authMode === 'string' ? controls.authMode : 'unknown',
      auditRetentionDays: Number(controls.auditRetentionDays || 0),
      dispatchEventRetentionDays: Number(
        controls.dispatchEventRetentionDays || 0,
      ),
    },
    counts: {
      totalEntries: Number(counts.totalEntries || 0),
      last24hEntries: Number(counts.last24hEntries || 0),
      last7dEntries: Number(counts.last7dEntries || 0),
    },
    actionBreakdown: Array.isArray(record.actionBreakdown)
      ? record.actionBreakdown
          .map((item) => {
            const next = isRecord(item) ? item : {};
            return {
              action:
                typeof next.action === 'string' ? next.action : 'unknown',
              count: Number(next.count || 0),
            };
          })
          .filter((item) => item.action)
      : [],
    recentEntries: Array.isArray(record.recentEntries)
      ? record.recentEntries.map(normalizeAuditEntry)
      : [],
  };
};

export const getAuditOverview = async (): Promise<AuditOverviewRecord> => {
  if (isPreview()) {
    const recentEntries = previewState.timeline.slice(0, 5).map((event, index) => ({
      id: event.id || `preview-audit-${index}`,
      organizationId: 'preview-org',
      actorId: event.actor || 'preview-user',
      actorType: 'user',
      entityType: event.routeId ? 'route_run' : 'system',
      entityId: event.routeId || event.id,
      action: event.action || event.code,
      source: event.source,
      createdAt: event.createdAt,
    }));
    return {
      generatedAt: new Date().toISOString(),
      controls: {
        requestIdsEnabled: true,
        structuredRequestLogging: true,
        sensitiveFieldRedaction: true,
        authMode: 'preview-bypass',
        auditRetentionDays: 90,
        dispatchEventRetentionDays: 90,
      },
      counts: {
        totalEntries: recentEntries.length,
        last24hEntries: recentEntries.length,
        last7dEntries: recentEntries.length,
      },
      actionBreakdown: recentEntries.map((entry) => ({
        action: entry.action,
        count: 1,
      })),
      recentEntries,
    };
  }

  const response = await apiFetch('/api/audit/overview');
  return normalizeAuditOverview(unwrapApiData<unknown>(await response.json()));
};

export const getAuditEntries = async (params: {
  limit?: number;
  action?: string;
  entityType?: string;
  actorId?: string;
} = {}): Promise<AuditLogRecord[]> => {
  if (isPreview()) {
    return (await getAuditOverview()).recentEntries;
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }

  const response = await apiFetch(
    `/api/audit${search.size ? `?${search.toString()}` : ''}`,
  );
  const data = await response.json();
  return unwrapListItems<unknown>(data, ['entries', 'items']).map(
    normalizeAuditEntry,
  );
};

export const useAuditOverviewQuery = () =>
  useQuery({
    queryKey: queryKeys.auditOverview,
    queryFn: getAuditOverview,
  });
