import { unwrapApiData } from '@shared/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api.session';
import { isPreview } from './api.preview';
import { isRecord } from './api.types';
import { queryKeys } from './queryKeys';

export type MarketingLeadStatus = 'new' | 'contacted' | 'qualified' | 'closed';
export type LeadNotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export type MarketingLeadRecord = {
  id: string;
  name: string;
  workEmail: string;
  company: string;
  fleetSize: string;
  exactFleetSize: number | null;
  requestType: string;
  notes: string | null;
  source: string;
  pagePath: string | null;
  status: MarketingLeadStatus;
  notificationStatus: LeadNotificationStatus;
  notificationError: string | null;
  notificationAttempts: number;
  lastNotificationAttemptAt: string | null;
  nextNotificationAttemptAt: string | null;
  createdAt: string;
};

const normalizeLead = (value: unknown): MarketingLeadRecord => {
  const record = isRecord(value) ? value : {};
  const status =
    record.status === 'contacted' ||
    record.status === 'qualified' ||
    record.status === 'closed'
      ? record.status
      : 'new';
  const notificationStatus =
    record.notificationStatus === 'sent' ||
    record.notificationStatus === 'failed' ||
    record.notificationStatus === 'skipped'
      ? record.notificationStatus
      : 'pending';

  return {
    id: typeof record.id === 'string' ? record.id : 'unknown-lead',
    name: typeof record.name === 'string' ? record.name : 'Unknown contact',
    workEmail:
      typeof record.workEmail === 'string' ? record.workEmail : 'Unavailable',
    company: typeof record.company === 'string' ? record.company : 'Unknown company',
    fleetSize: typeof record.fleetSize === 'string' ? record.fleetSize : 'Unknown',
    exactFleetSize:
      typeof record.exactFleetSize === 'number' ? record.exactFleetSize : null,
    requestType:
      typeof record.requestType === 'string' ? record.requestType : 'General inquiry',
    notes: typeof record.notes === 'string' ? record.notes : null,
    source: typeof record.source === 'string' ? record.source : 'trytrovan.com',
    pagePath: typeof record.pagePath === 'string' ? record.pagePath : null,
    status,
    notificationStatus,
    notificationError:
      typeof record.notificationError === 'string'
        ? record.notificationError
        : null,
    notificationAttempts:
      typeof record.notificationAttempts === 'number'
        ? record.notificationAttempts
        : 0,
    lastNotificationAttemptAt:
      typeof record.lastNotificationAttemptAt === 'string'
        ? record.lastNotificationAttemptAt
        : null,
    nextNotificationAttemptAt:
      typeof record.nextNotificationAttemptAt === 'string'
        ? record.nextNotificationAttemptAt
        : null,
    createdAt:
      typeof record.createdAt === 'string'
        ? record.createdAt
        : new Date().toISOString(),
  };
};

let previewLeadStore: MarketingLeadRecord[] = [
  {
    id: 'preview-lead-1',
    name: 'Jordan Lee',
    workEmail: 'jordan@example.com',
    company: 'Northline Logistics',
    fleetSize: '16–35',
    exactFleetSize: 24,
    requestType: 'Book demo',
    notes: 'Reviewing dispatch controls for an assisted pilot.',
    source: 'trytrovan.com',
    pagePath: '/pricing',
    status: 'new',
    notificationStatus: 'sent',
    notificationError: null,
    notificationAttempts: 1,
    lastNotificationAttemptAt: new Date().toISOString(),
    nextNotificationAttemptAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'preview-lead-2',
    name: 'Avery Morgan',
    workEmail: 'avery@example.com',
    company: 'Hearthside Services',
    fleetSize: '36–75',
    exactFleetSize: 48,
    requestType: 'Security review',
    notes: 'Needs data-flow and subprocessor documentation.',
    source: 'trytrovan.com',
    pagePath: '/security',
    status: 'contacted',
    notificationStatus: 'failed',
    notificationError: 'Postmark returned 503; retry scheduled',
    notificationAttempts: 1,
    lastNotificationAttemptAt: new Date().toISOString(),
    nextNotificationAttemptAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
];

export async function getMarketingLeads(): Promise<MarketingLeadRecord[]> {
  if (isPreview()) return previewLeadStore.map((lead) => ({ ...lead }));
  const response = await apiFetch('/api/marketing-leads');
  const data = unwrapApiData<{ leads?: unknown }>(await response.json());
  return Array.isArray(data.leads) ? data.leads.map(normalizeLead) : [];
}

export async function getMarketingLeadAccess(): Promise<boolean> {
  if (isPreview()) return true;
  const response = await apiFetch('/api/marketing-leads/access');
  const data = unwrapApiData<{ operatorAccess?: unknown }>(
    await response.json(),
  );
  return data.operatorAccess === true;
}

export async function updateMarketingLeadStatus({
  leadId,
  status,
}: {
  leadId: string;
  status: MarketingLeadStatus;
}) {
  if (isPreview()) {
    previewLeadStore = previewLeadStore.map((lead) =>
      lead.id === leadId ? { ...lead, status } : lead,
    );
    return previewLeadStore.find((lead) => lead.id === leadId) ?? null;
  }
  const response = await apiFetch(`/api/marketing-leads/${leadId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  const data = unwrapApiData<{ lead?: unknown }>(await response.json());
  return data.lead ? normalizeLead(data.lead) : null;
}

export async function retryMarketingLeadNotification(leadId: string) {
  if (isPreview()) {
    const attemptedAt = new Date().toISOString();
    previewLeadStore = previewLeadStore.map((lead) =>
      lead.id === leadId
        ? {
            ...lead,
            notificationStatus: 'sent',
            notificationError: null,
            notificationAttempts: lead.notificationAttempts + 1,
            lastNotificationAttemptAt: attemptedAt,
            nextNotificationAttemptAt: null,
          }
        : lead,
    );
    return previewLeadStore.find((lead) => lead.id === leadId) ?? null;
  }
  const response = await apiFetch(
    `/api/marketing-leads/${leadId}/retry-notification`,
    { method: 'POST' },
  );
  const data = unwrapApiData<{ lead?: unknown }>(await response.json());
  return data.lead ? normalizeLead(data.lead) : null;
}

export function useMarketingLeadAccessQuery() {
  return useQuery({
    queryKey: queryKeys.marketingLeadAccess,
    queryFn: getMarketingLeadAccess,
    retry: false,
  });
}

export function useMarketingLeadsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.marketingLeads,
    queryFn: getMarketingLeads,
    enabled,
  });
}

export function useUpdateMarketingLeadStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMarketingLeadStatus,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.marketingLeads }),
  });
}

export function useRetryMarketingLeadNotificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retryMarketingLeadNotification,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.marketingLeads }),
  });
}
