import { unwrapApiData } from '@shared/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api.session';
import { isPreview } from './api.preview';
import {
  isRecord,
  type PlatformApiKeyRecord,
  type PlatformWebhookDeliveryRecord,
  type PlatformWebhookRecord,
} from './api.types';
import { queryKeys } from './queryKeys';

type PlatformOverviewRecord = {
  generatedAt: string;
  authMode: string;
  apiKeysActive: number;
  webhooksActive: number;
  deliveriesLast24Hours: number;
  failuresLast24Hours: number;
  controls: {
    externalApiEnabled: boolean;
    signedWebhooksEnabled: boolean;
    requestIdsEnabled: boolean;
  };
};

const normalizePlatformOverview = (value: unknown): PlatformOverviewRecord => {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const controls =
    record.controls &&
    typeof record.controls === 'object' &&
    !Array.isArray(record.controls)
      ? (record.controls as Record<string, unknown>)
      : {};

  return {
    generatedAt:
      typeof record.generatedAt === 'string'
        ? record.generatedAt
        : new Date().toISOString(),
    authMode: typeof record.authMode === 'string' ? record.authMode : 'unknown',
    apiKeysActive:
      typeof record.apiKeysActive === 'number' ? record.apiKeysActive : 0,
    webhooksActive:
      typeof record.webhooksActive === 'number' ? record.webhooksActive : 0,
    deliveriesLast24Hours:
      typeof record.deliveriesLast24Hours === 'number'
        ? record.deliveriesLast24Hours
        : 0,
    failuresLast24Hours:
      typeof record.failuresLast24Hours === 'number'
        ? record.failuresLast24Hours
        : 0,
    controls: {
      externalApiEnabled: Boolean(controls.externalApiEnabled),
      signedWebhooksEnabled: Boolean(controls.signedWebhooksEnabled),
      requestIdsEnabled: Boolean(controls.requestIdsEnabled),
    },
  };
};

const normalizeApiKey = (value: unknown): PlatformApiKeyRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id: typeof record.id === 'string' ? record.id : 'unknown-key',
    organizationId:
      typeof record.organizationId === 'string'
        ? record.organizationId
        : 'unknown-org',
    name: typeof record.name === 'string' ? record.name : 'API Key',
    prefix: typeof record.prefix === 'string' ? record.prefix : 'trovan',
    scopes: Array.isArray(record.scopes)
      ? record.scopes.filter((item): item is string => typeof item === 'string')
      : [],
    lastUsedAt:
      typeof record.lastUsedAt === 'string' ? record.lastUsedAt : null,
    revokedAt: typeof record.revokedAt === 'string' ? record.revokedAt : null,
    createdByUserId:
      typeof record.createdByUserId === 'string'
        ? record.createdByUserId
        : null,
    createdAt:
      typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt:
      typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
};

const normalizeWebhook = (value: unknown): PlatformWebhookRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id: typeof record.id === 'string' ? record.id : 'unknown-webhook',
    organizationId:
      typeof record.organizationId === 'string'
        ? record.organizationId
        : 'unknown-org',
    name: typeof record.name === 'string' ? record.name : 'Webhook',
    url: typeof record.url === 'string' ? record.url : '',
    subscribedEvents: Array.isArray(record.subscribedEvents)
      ? record.subscribedEvents.filter(
          (item): item is string => typeof item === 'string',
        )
      : [],
    status: record.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
    lastDeliveryAt:
      typeof record.lastDeliveryAt === 'string'
        ? record.lastDeliveryAt
        : null,
    lastFailure:
      typeof record.lastFailure === 'string' ? record.lastFailure : null,
    createdByUserId:
      typeof record.createdByUserId === 'string'
        ? record.createdByUserId
        : null,
    createdAt:
      typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt:
      typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
};

const normalizeWebhookDelivery = (
  value: unknown,
): PlatformWebhookDeliveryRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id: typeof record.id === 'string' ? record.id : 'unknown-delivery',
    endpointId:
      typeof record.endpointId === 'string' ? record.endpointId : 'unknown-endpoint',
    organizationId:
      typeof record.organizationId === 'string'
        ? record.organizationId
        : 'unknown-org',
    eventType:
      typeof record.eventType === 'string' ? record.eventType : 'unknown',
    status: typeof record.status === 'string' ? record.status : 'PENDING',
    requestId:
      typeof record.requestId === 'string' ? record.requestId : null,
    attempts: typeof record.attempts === 'number' ? record.attempts : 0,
    responseStatus:
      typeof record.responseStatus === 'number' ? record.responseStatus : null,
    failureReason:
      typeof record.failureReason === 'string' ? record.failureReason : null,
    payload: isRecord(record.payload) ? record.payload : {},
    deliveredAt:
      typeof record.deliveredAt === 'string' ? record.deliveredAt : null,
    createdAt:
      typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt:
      typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
};

const previewApiKeys = (): PlatformApiKeyRecord[] => [
  {
    id: 'key-preview-1',
    organizationId: 'preview-org',
    name: 'Public API integration',
    prefix: 'tvp_01',
    scopes: ['jobs:read', 'customers:read', 'route-runs:read'],
    lastUsedAt: new Date().toISOString(),
    revokedAt: null,
    createdByUserId: 'preview-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const previewWebhooks = (): PlatformWebhookRecord[] => [
  {
    id: 'webhook-preview-1',
    organizationId: 'preview-org',
    name: 'Ops dashboard sync',
    url: 'https://example.trovan.local/hooks/ops',
    subscribedEvents: ['route-run.started', 'route-run.completed', 'proof.captured'],
    status: 'ACTIVE',
    lastDeliveryAt: new Date().toISOString(),
    lastFailure: null,
    createdByUserId: 'preview-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const previewWebhookDeliveries = (): PlatformWebhookDeliveryRecord[] => [
  {
    id: 'delivery-preview-1',
    endpointId: 'webhook-preview-1',
    organizationId: 'preview-org',
    eventType: 'route-run.completed',
    status: 'FAILED',
    requestId: 'req-preview-1',
    attempts: 2,
    responseStatus: 500,
    failureReason: 'Preview endpoint unavailable.',
    payload: {},
    deliveredAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export async function getPlatformOverview(): Promise<PlatformOverviewRecord> {
  if (isPreview()) {
    return {
      generatedAt: new Date().toISOString(),
      authMode: 'preview-local',
      apiKeysActive: previewApiKeys().length,
      webhooksActive: previewWebhooks().length,
      deliveriesLast24Hours: 6,
      failuresLast24Hours: 1,
      controls: {
        externalApiEnabled: true,
        signedWebhooksEnabled: true,
        requestIdsEnabled: true,
      },
    };
  }
  const response = await apiFetch('/api/platform/overview');
  const payload = await response.json();
  const data =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? ((payload as Record<string, unknown>).data ||
          payload) as Record<string, unknown>
      : {};
  return normalizePlatformOverview(data.overview);
}

export async function getApiKeys(): Promise<PlatformApiKeyRecord[]> {
  if (isPreview()) {
    return previewApiKeys();
  }
  const response = await apiFetch('/api/platform/api-keys');
  const payload = unwrapApiData<{ apiKeys?: unknown[] }>(await response.json());
  return Array.isArray(payload.apiKeys)
    ? payload.apiKeys.map(normalizeApiKey)
    : [];
}

export async function createApiKey(payload: {
  name: string;
  scopes?: string[];
}): Promise<{ apiKey: PlatformApiKeyRecord; secret: string | null }> {
  const response = await apiFetch('/api/platform/api-keys', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = unwrapApiData<{ apiKey?: unknown; secret?: unknown }>(
    await response.json(),
  );
  return {
    apiKey: normalizeApiKey(data.apiKey),
    secret: typeof data.secret === 'string' ? data.secret : null,
  };
}

export async function revokeApiKey(apiKeyId: string) {
  const response = await apiFetch(`/api/platform/api-keys/${apiKeyId}`, {
    method: 'DELETE',
  });
  const data = unwrapApiData<{ apiKey?: unknown }>(await response.json());
  return data.apiKey ? normalizeApiKey(data.apiKey) : null;
}

export async function getWebhooks(): Promise<PlatformWebhookRecord[]> {
  if (isPreview()) {
    return previewWebhooks();
  }
  const response = await apiFetch('/api/platform/webhooks');
  const payload = unwrapApiData<{ webhooks?: unknown[] }>(await response.json());
  return Array.isArray(payload.webhooks)
    ? payload.webhooks.map(normalizeWebhook)
    : [];
}

export async function createWebhook(payload: {
  name: string;
  url: string;
  subscribedEvents: string[];
}): Promise<{ endpoint: PlatformWebhookRecord; signingSecret: string | null }> {
  const response = await apiFetch('/api/platform/webhooks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = unwrapApiData<{ endpoint?: unknown; signingSecret?: unknown }>(
    await response.json(),
  );
  return {
    endpoint: normalizeWebhook(data.endpoint),
    signingSecret:
      typeof data.signingSecret === 'string' ? data.signingSecret : null,
  };
}

export async function updateWebhook(
  webhookId: string,
  payload: {
    name?: string;
    url?: string;
    subscribedEvents?: string[];
    status?: 'ACTIVE' | 'PAUSED';
  },
) {
  const response = await apiFetch(`/api/platform/webhooks/${webhookId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  const data = unwrapApiData<{ webhook?: unknown }>(await response.json());
  return data.webhook ? normalizeWebhook(data.webhook) : null;
}

export async function rotateWebhookSecret(webhookId: string) {
  const response = await apiFetch(
    `/api/platform/webhooks/${webhookId}/rotate-secret`,
    {
      method: 'POST',
    },
  );
  const data = unwrapApiData<{ webhook?: unknown; signingSecret?: unknown }>(
    await response.json(),
  );
  return {
    webhook: data.webhook ? normalizeWebhook(data.webhook) : null,
    signingSecret:
      typeof data.signingSecret === 'string' ? data.signingSecret : null,
  };
}

export async function getWebhookDeliveries(
  endpointId?: string,
): Promise<PlatformWebhookDeliveryRecord[]> {
  if (isPreview()) {
    return previewWebhookDeliveries().filter((delivery) =>
      endpointId ? delivery.endpointId === endpointId : true,
    );
  }
  const searchParams = new URLSearchParams();
  if (endpointId) {
    searchParams.set('endpointId', endpointId);
  }
  const response = await apiFetch(
    `/api/platform/webhook-deliveries${
      searchParams.toString() ? `?${searchParams.toString()}` : ''
    }`,
  );
  const payload = unwrapApiData<{ deliveries?: unknown[] }>(
    await response.json(),
  );
  return Array.isArray(payload.deliveries)
    ? payload.deliveries.map(normalizeWebhookDelivery)
    : [];
}

export async function replayWebhookDelivery(deliveryId: string) {
  const response = await apiFetch(
    `/api/platform/webhook-deliveries/${deliveryId}/replay`,
    {
      method: 'POST',
    },
  );
  const data = unwrapApiData<{ delivery?: unknown }>(await response.json());
  return data.delivery ? normalizeWebhookDelivery(data.delivery) : null;
}

export function usePlatformOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.platformOverview,
    queryFn: getPlatformOverview,
  });
}

export function useApiKeysQuery() {
  return useQuery({
    queryKey: queryKeys.apiKeys,
    queryFn: getApiKeys,
  });
}

export function useWebhooksQuery() {
  return useQuery({
    queryKey: queryKeys.webhooks,
    queryFn: getWebhooks,
  });
}

export function useWebhookDeliveriesQuery(endpointId?: string) {
  return useQuery({
    queryKey: queryKeys.webhookDeliveries(endpointId),
    queryFn: () => getWebhookDeliveries(endpointId),
  });
}

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createApiKey,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platformOverview }),
      ]);
    },
  });
}

export function useRevokeApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeApiKey,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platformOverview }),
      ]);
    },
  });
}

export function useCreateWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWebhook,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.webhooks }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.platformOverview,
        }),
      ]);
    },
  });
}

export function useUpdateWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      webhookId,
      payload,
    }: {
      webhookId: string;
      payload: {
        name?: string;
        url?: string;
        subscribedEvents?: string[];
        status?: 'ACTIVE' | 'PAUSED';
      };
    }) => updateWebhook(webhookId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.webhooks }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.webhookDeliveries(undefined),
        }),
      ]);
    },
  });
}

export function useRotateWebhookSecretMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rotateWebhookSecret,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
    },
  });
}

export function useReplayWebhookDeliveryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: replayWebhookDelivery,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.webhookDeliveries(undefined),
      });
    },
  });
}
