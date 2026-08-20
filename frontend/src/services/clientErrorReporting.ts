import { apiFetch } from './api.session';

let installed = false;

export function reportClientError(error: unknown, componentStack?: string) {
  const normalized = error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: 'ClientError', message: String(error || 'Unknown client error') };
  void apiFetch('/api/monitoring/client-errors', {
    method: 'POST',
    body: JSON.stringify({
      ...normalized,
      componentStack: componentStack?.slice(0, 8_000),
      path: window.location.pathname,
    }),
  }).catch(() => undefined);
}

export function installGlobalClientErrorReporting() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) => {
    reportClientError(event.error || event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason);
  });
}
