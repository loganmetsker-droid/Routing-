import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api.session';
import { isPreview } from './api.preview';
import { queryKeys } from './queryKeys';

type NotificationsOverviewRecord = {
  generatedAt: string;
  emailProvider: string;
  smsProvider: string;
  sentLast24Hours: number;
  failedLast24Hours: number;
  controls: {
    emailReady: boolean;
    smsReady: boolean;
  };
};

const normalizeNotificationsOverview = (
  value: unknown,
): NotificationsOverviewRecord => {
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
    emailProvider:
      typeof record.emailProvider === 'string' ? record.emailProvider : 'disabled',
    smsProvider:
      typeof record.smsProvider === 'string' ? record.smsProvider : 'disabled',
    sentLast24Hours:
      typeof record.sentLast24Hours === 'number' ? record.sentLast24Hours : 0,
    failedLast24Hours:
      typeof record.failedLast24Hours === 'number'
        ? record.failedLast24Hours
        : 0,
    controls: {
      emailReady: Boolean(controls.emailReady),
      smsReady: Boolean(controls.smsReady),
    },
  };
};

export async function getNotificationsOverview(): Promise<NotificationsOverviewRecord> {
  if (isPreview()) {
    return {
      generatedAt: new Date().toISOString(),
      emailProvider: 'postmark-preview',
      smsProvider: 'twilio-preview',
      sentLast24Hours: 18,
      failedLast24Hours: 2,
      controls: {
        emailReady: true,
        smsReady: true,
      },
    };
  }
  const response = await apiFetch('/api/notifications/overview');
  const payload = await response.json();
  const data =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? ((payload as Record<string, unknown>).data ||
          payload) as Record<string, unknown>
      : {};
  return normalizeNotificationsOverview(data.overview);
}

export function useNotificationsOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.notificationsOverview,
    queryFn: getNotificationsOverview,
  });
}
