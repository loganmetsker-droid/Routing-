import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CssBaseline from '@mui/material/CssBaseline';
import 'leaflet/dist/leaflet.css';
import { ThemeProvider } from './contexts/ThemeContext';
import App from './App';
import ErrorBoundary from './components/ui/ErrorBoundary';
import './styles/index.css';

const LOCAL_DEMO_AUTH_TOKEN = 'preview-auth-bypass';
const LOCAL_PREVIEW_PORT = '5186';
const localPreviewHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

const isLocalPreviewHost = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.location.port === LOCAL_PREVIEW_PORT ||
    localPreviewHosts.has(window.location.hostname)
  );
};

const hasLiveAuthOverride = () => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('auth') === 'live';
};

const isDriverRoute = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/driver' || window.location.pathname.startsWith('/driver/');
};

const bootstrapLocalDemoMode = () => {
  try {
    if (typeof window === 'undefined') return;
    if (!isLocalPreviewHost()) return;
    if (hasLiveAuthOverride()) {
      window.localStorage.removeItem('authToken');
      return;
    }
    (window as unknown as { __TROVAN_LOCAL_DEMO_PREVIEW__?: boolean })
      .__TROVAN_LOCAL_DEMO_PREVIEW__ = true;
    if (!window.localStorage.getItem('authToken')) {
      window.localStorage.setItem('authToken', LOCAL_DEMO_AUTH_TOKEN);
    }
  } catch {
    // Demo bootstrap is best-effort only.
  }
};

bootstrapLocalDemoMode();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

if ('serviceWorker' in navigator && import.meta.env.PROD && !isLocalPreviewHost()) {
  window.addEventListener('load', () => {
    if (isDriverRoute()) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
      return;
    }

    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => ('caches' in window ? caches.keys() : []))
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('trovan-')).map((key) => caches.delete(key))))
      .catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <CssBaseline />
          <ErrorBoundary
            title="Trovan Failed To Load"
            message="The application shell crashed during startup. Reload after checking the current build and backend health."
          >
            <App />
          </ErrorBoundary>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
