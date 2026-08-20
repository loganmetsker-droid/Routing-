import { useQuery } from '@tanstack/react-query';
import { getTrovanDataMode, usesPreviewDataMode } from './dataMode';

export type RuntimeReadiness = {
  status: 'ok' | 'error' | 'unknown';
  missingCritical: string[];
  launchWarnings: string[];
  checkedAt: string;
};

export type WorkspaceRuntimeStatus = {
  state: 'preview' | 'healthy' | 'degraded' | 'unknown';
  label: string;
  detail: string;
};

const readinessUrl = () => {
  const configured = String(import.meta.env.VITE_REST_API_URL || '').trim();
  const base = configured || window.location.origin;
  return new URL('/health/readiness', base).toString();
};

export async function getRuntimeReadiness(): Promise<RuntimeReadiness> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(readinessUrl(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    return {
      status: payload.status === 'ok' ? 'ok' : payload.status === 'error' ? 'error' : 'unknown',
      missingCritical: Array.isArray(payload.missingCritical)
        ? payload.missingCritical.filter((item): item is string => typeof item === 'string')
        : [],
      launchWarnings: Array.isArray(payload.launchWarnings)
        ? payload.launchWarnings.filter((item): item is string => typeof item === 'string')
        : [],
      checkedAt: new Date().toISOString(),
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export function workspaceRuntimeStatus(
  dataMode: ReturnType<typeof getTrovanDataMode>,
  readiness?: RuntimeReadiness,
  unavailable = false,
): WorkspaceRuntimeStatus {
  if (usesPreviewDataMode(dataMode)) {
    return {
      state: 'preview',
      label: 'Preview workspace',
      detail: 'Local synthetic data',
    };
  }
  if (dataMode === 'degraded' || readiness?.status === 'error') {
    const count = readiness?.missingCritical.length || 0;
    return {
      state: 'degraded',
      label: 'Service degraded',
      detail: count ? `${count} critical ${count === 1 ? 'dependency' : 'dependencies'} unavailable` : 'Fallback data active',
    };
  }
  if (readiness?.status === 'ok') {
    return {
      state: 'healthy',
      label: 'Systems ready',
      detail: 'Live persisted workspace',
    };
  }
  return {
    state: 'unknown',
    label: unavailable ? 'Status unavailable' : 'Checking service status',
    detail: unavailable ? 'Readiness endpoint could not be reached' : 'Waiting for readiness checks',
  };
}

export function useRuntimeReadinessQuery() {
  const dataMode = getTrovanDataMode();
  return useQuery({
    queryKey: ['runtime-readiness'],
    queryFn: getRuntimeReadiness,
    enabled: !usesPreviewDataMode(dataMode),
    retry: 1,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
